// Transacción multi-paso del dominio: prestar un e-book, y su contraparte, la devolución.
// Los pasos y códigos de error son los de POST /prestamos y POST /prestamos/{id}/devolucion del contrato.
const { withTransaction } = require('../lib/db');
const { notFound, conflict, forbidden } = require('../lib/errors');
const { publishSafely } = require('../lib/rabbit');
const { log, withSpan } = require('../lib/observability');
const titulos = require('../repositories/titulos');
const usuarios = require('../repositories/usuarios');
const prestamos = require('../repositories/prestamos');
const reservas = require('../repositories/reservas');
const avisos = require('../repositories/avisos');
const listaEspera = require('../ws/listaEspera');

async function prestar({ usuarioId, tituloId, diasPrestamo = 14, unirseListaEspera = false }) {
  const resultado = await withSpan('prestamo.prestar', { 'usuario.id': usuarioId, 'titulo.id': tituloId }, () =>
    withTransaction(async (client) => {
      // 1. Usuario existente y habilitado.
      const usuario = await usuarios.obtener(usuarioId, client);
      if (!usuario) throw notFound('USUARIO_NO_ENCONTRADO', `No existe el usuario ${usuarioId}`);
      if (usuario.estado === 'BLOQUEADO') {
        throw forbidden('USUARIO_BLOQUEADO', `El usuario ${usuarioId} está bloqueado y no puede solicitar préstamos`);
      }
      // 2. Sin préstamos vencidos sin devolver.
      if (await prestamos.tieneVencidos(client, usuarioId)) {
        throw forbidden('PRESTAMOS_VENCIDOS', `El usuario ${usuarioId} tiene préstamos vencidos sin devolver`);
      }
      // 3. Título existente, bloqueado hasta el COMMIT para que dos préstamos no tomen el mismo cupo.
      const titulo = await titulos.bloquear(client, tituloId);
      if (!titulo) throw notFound('TITULO_NO_ENCONTRADO', `No existe el título ${tituloId}`);
      // 4. Sin otro préstamo sin devolver del mismo título.
      if (await prestamos.tieneSinDevolver(client, usuarioId, tituloId)) {
        throw conflict('PRESTAMO_DUPLICADO', 'El usuario ya tiene un préstamo sin devolver de este título');
      }
      // 5. Cupo libre respetando la lista de espera (FIFO).
      const propia = await reservas.vigente(client, usuarioId, tituloId);
      const desde = propia ? propia.created_at : 'infinity';
      const guardados = await reservas.cuposGuardadosParaOtros(client, tituloId, usuarioId, desde);
      const libre = titulo.cupoDisponible - guardados;
      if (libre <= 0) {
        if (!unirseListaEspera) throw conflict('CUPO_AGOTADO', `No hay cupo disponible para el título ${tituloId}`);
        if (propia) throw conflict('RESERVA_DUPLICADA', `El usuario ya está en la lista de espera del título ${tituloId}`);
        const reserva = await reservas.crear(client, usuarioId, tituloId);
        return { status: 202, body: reserva };
      }
      // 6. Si tenía una reserva, se cumple.
      if (propia) await reservas.marcarCumplida(client, propia.id);
      // 7. Descontar cupo y crear el préstamo con su vencimiento.
      await titulos.ajustarCupo(client, tituloId, -1);
      const prestamo = await prestamos.crear(client, { usuarioId, tituloId, diasPrestamo });
      return { status: 201, body: prestamo };
    }));

  if (resultado.status === 201) {
    log('prestamo.creado', { prestamo_id: resultado.body.id, usuario_id: usuarioId, titulo_id: tituloId });
    // Después del COMMIT: nunca se anuncia un préstamo que no existe (ADR 004).
    await publishSafely('prestamo.creado', resultado.body);
  } else {
    log('reserva.creada', { reserva_id: resultado.body.id, usuario_id: usuarioId, titulo_id: tituloId });
  }
  return resultado;
}

async function devolver(prestamoId) {
  const { prestamo, notificada, titulo } = await withSpan('prestamo.devolver', { 'prestamo.id': prestamoId }, () =>
    withTransaction(async (client) => {
      const actual = await prestamos.bloquear(client, prestamoId);
      if (!actual) throw notFound('PRESTAMO_NO_ENCONTRADO', `No existe el préstamo ${prestamoId}`);
      if (actual.estado === 'DEVUELTO') throw conflict('PRESTAMO_YA_DEVUELTO', `El préstamo ${prestamoId} ya fue devuelto`);

      const tituloBloqueado = await titulos.bloquear(client, actual.tituloId);
      const devuelto = await prestamos.marcarDevuelto(client, prestamoId);
      await titulos.ajustarCupo(client, actual.tituloId, 1);
      // El cupo liberado queda guardado para el primero de la cola.
      const reserva = await reservas.notificarPrimera(client, actual.tituloId);
      if (reserva) await avisos.registrarCupoDisponible(client, reserva);
      return { prestamo: devuelto, notificada: reserva, titulo: tituloBloqueado };
    }));

  log('prestamo.devuelto', { prestamo_id: prestamoId, titulo_id: prestamo.tituloId });
  if (notificada) {
    listaEspera.notificar(notificada.usuarioId, {
      type: 'cupo.disponible',
      reservaId: notificada.id,
      usuarioId: notificada.usuarioId,
      tituloId: notificada.tituloId,
      titulo: titulo.titulo,
      mensaje: `Hay un ejemplar de "${titulo.titulo}" reservado para vos`,
    });
  }
  return prestamo;
}

module.exports = { prestar, devolver };
