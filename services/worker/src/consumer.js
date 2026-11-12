// Consumidor de prestamo.creado: registra el aviso PRESTAMO_CONFIRMADO (efecto visible del flujo asincrónico).
// Decide ack / retry / DLQ como el laboratorio de la clase 07:
//   - error permanente (mensaje inválido, préstamo inexistente) -> DLQ directo
//   - error transitorio (base caída, falla simulada) -> retry con TTL, hasta MAX_RETRIES; después DLQ
//   - evento repetido (re-entrega) -> ack sin duplicar el aviso (índice único en avisos)

class PermanentMessageError extends Error {}
class TransientMessageError extends Error {}

function parseEvento(content) {
  let event;
  try {
    event = JSON.parse(content.toString());
  } catch {
    throw new PermanentMessageError('JSON inválido');
  }
  const prestamoId = Number(event?.data?.id);
  if (event?.type !== 'prestamo.creado' || typeof event.eventId !== 'string' || !Number.isSafeInteger(prestamoId)) {
    throw new PermanentMessageError('El mensaje no cumple el contrato EventoPrestamoCreado');
  }
  return { ...event, prestamoId };
}

function retryCountOf(message) {
  const value = Number(message.properties.headers?.['x-retry-count'] ?? 0);
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

// Efecto de negocio: un aviso por préstamo, idempotente por el índice único (prestamo_id, tipo).
async function registrarAviso(db, prestamoId) {
  let result;
  try {
    result = await db.query(
      `INSERT INTO avisos (usuario_id, prestamo_id, tipo, canal)
       SELECT usuario_id, id, 'PRESTAMO_CONFIRMADO', 'LOG' FROM prestamos WHERE id = $1
       ON CONFLICT DO NOTHING RETURNING id, usuario_id`,
      [prestamoId],
    );
  } catch (error) {
    throw new TransientMessageError(`la base no pudo registrar el aviso: ${error.message}`);
  }
  if (result.rowCount === 1) return { duplicado: false, avisoId: Number(result.rows[0].id), usuarioId: Number(result.rows[0].usuario_id) };
  const existe = await db.query('SELECT 1 FROM prestamos WHERE id = $1', [prestamoId]);
  if (existe.rowCount === 0) throw new PermanentMessageError(`no existe el préstamo ${prestamoId}`);
  return { duplicado: true };
}

async function processMessage(message, channel, deps) {
  const { db, log, config, publishRetry, publishDlq } = deps;
  const count = retryCountOf(message);
  try {
    const event = parseEvento(message.content);
    if (count < config.simulatedFailures) {
      throw new TransientMessageError(`falla transitoria simulada ${count + 1}/${config.simulatedFailures}`);
    }
    const resultado = await registrarAviso(db, event.prestamoId);
    if (resultado.duplicado) {
      log('evento.duplicado', { event_id: event.eventId, prestamo_id: event.prestamoId, attempt: count });
    } else {
      log('aviso.registrado', {
        tipo: 'PRESTAMO_CONFIRMADO', aviso_id: resultado.avisoId, prestamo_id: event.prestamoId,
        usuario_id: resultado.usuarioId, event_id: event.eventId, attempt: count,
      });
    }
    channel.ack(message);
    return resultado.duplicado ? 'duplicado' : 'procesado';
  } catch (error) {
    log('evento.fallido', { error_type: error.constructor.name, error_message: error.message, attempt: count }, 'error');
    if (!(error instanceof PermanentMessageError) && count < config.maxRetries) {
      await publishRetry(channel, message, count + 1, error.message);
      channel.ack(message);
      log('evento.reintento', { attempt: count + 1, delay_ms: config.retryDelayMs }, 'warn');
      return 'reintento';
    }
    const reason = error instanceof PermanentMessageError
      ? `permanente: ${error.message}`
      : `reintentos agotados (${count}/${config.maxRetries}): ${error.message}`;
    await publishDlq(channel, message, reason, count);
    channel.ack(message);
    log('evento.dlq', { attempt: count, reason }, 'error');
    return 'dlq';
  }
}

module.exports = {
  PermanentMessageError, TransientMessageError, parseEvento, retryCountOf, registrarAviso, processMessage,
};
