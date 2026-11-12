const { query } = require('../lib/db');
const map = require('./mappers');

// La posición se calcula por antigüedad (FIFO) entre las reservas EN_ESPERA del mismo título.
const POSICION = `CASE WHEN r.estado = 'EN_ESPERA' THEN (
    SELECT count(*) FROM reservas r2
     WHERE r2.titulo_id = r.titulo_id AND r2.estado = 'EN_ESPERA'
       AND (r2.created_at, r2.id) <= (r.created_at, r.id)
  ) END AS posicion`;

async function listar({ tituloId, estado }) {
  const { rows } = await query(
    `SELECT r.*, ${POSICION} FROM reservas r
      WHERE ($1::bigint IS NULL OR r.titulo_id = $1)
        AND ($2::estado_reserva IS NULL OR r.estado = $2)
      ORDER BY r.created_at, r.id`,
    [tituloId ?? null, estado ?? null],
  );
  return rows.map(map.reserva);
}

async function obtener(client, id) {
  const { rows } = await client.query(`SELECT r.*, ${POSICION} FROM reservas r WHERE r.id = $1`, [id]);
  return map.reserva(rows[0]);
}

// Reserva vigente (EN_ESPERA o NOTIFICADA) del usuario para el título.
async function vigente(client, usuarioId, tituloId) {
  const { rows } = await client.query(
    `SELECT * FROM reservas WHERE usuario_id = $1 AND titulo_id = $2
        AND estado IN ('EN_ESPERA', 'NOTIFICADA')`,
    [usuarioId, tituloId],
  );
  return rows[0] || null;
}

// Cupos guardados para otros usuarios: los ya notificados y los que esperan antes que el solicitante.
async function cuposGuardadosParaOtros(client, tituloId, usuarioId, desde) {
  const { rows } = await client.query(
    `SELECT count(*) FILTER (WHERE estado = 'NOTIFICADA')::int AS notificadas,
            count(*) FILTER (WHERE estado = 'EN_ESPERA' AND created_at < $3)::int AS en_espera_antes
       FROM reservas WHERE titulo_id = $1 AND usuario_id <> $2`,
    [tituloId, usuarioId, desde],
  );
  return rows[0].notificadas + rows[0].en_espera_antes;
}

async function crear(client, usuarioId, tituloId) {
  const { rows } = await client.query(
    'INSERT INTO reservas (usuario_id, titulo_id) VALUES ($1, $2) RETURNING id',
    [usuarioId, tituloId],
  );
  return obtener(client, rows[0].id);
}

async function marcarCumplida(client, id) {
  await client.query("UPDATE reservas SET estado = 'CUMPLIDA' WHERE id = $1", [id]);
}

// Toma la primera reserva EN_ESPERA del título y la pasa a NOTIFICADA.
async function notificarPrimera(client, tituloId) {
  const { rows } = await client.query(
    `UPDATE reservas SET estado = 'NOTIFICADA', notificada_at = now()
      WHERE id = (
        SELECT id FROM reservas WHERE titulo_id = $1 AND estado = 'EN_ESPERA'
         ORDER BY created_at, id LIMIT 1 FOR UPDATE
      ) RETURNING *`,
    [tituloId],
  );
  return rows[0] ? map.reserva(rows[0]) : null;
}

module.exports = {
  listar, vigente, cuposGuardadosParaOtros, crear, marcarCumplida, notificarPrimera,
};
