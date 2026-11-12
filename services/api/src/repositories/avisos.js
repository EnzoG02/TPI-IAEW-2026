const { query } = require('../lib/db');
const map = require('./mappers');

async function listar({ usuarioId, prestamoId, tipo, page, pageSize, offset }) {
  const { rows } = await query(
    `SELECT *, count(*) OVER () AS total FROM avisos
      WHERE ($1::bigint IS NULL OR usuario_id = $1)
        AND ($2::bigint IS NULL OR prestamo_id = $2)
        AND ($3::tipo_aviso IS NULL OR tipo = $3)
      ORDER BY created_at DESC, id DESC LIMIT $4 OFFSET $5`,
    [usuarioId ?? null, prestamoId ?? null, tipo ?? null, pageSize, offset],
  );
  return map.page(rows, map.aviso, { page, pageSize });
}

// Aviso de cupo disponible para el primero de la lista de espera (canal WebSocket).
async function registrarCupoDisponible(client, reserva) {
  await client.query(
    `INSERT INTO avisos (usuario_id, reserva_id, tipo, canal)
     VALUES ($1, $2, 'CUPO_DISPONIBLE', 'WEBSOCKET') ON CONFLICT DO NOTHING`,
    [reserva.usuarioId, reserva.id],
  );
}

module.exports = { listar, registrarCupoDisponible };
