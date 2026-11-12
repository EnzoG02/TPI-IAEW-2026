const { query } = require('../lib/db');
const map = require('./mappers');

async function listar({ estado, usuarioId, page, pageSize, offset }) {
  const { rows } = await query(
    `SELECT *, count(*) OVER () AS total FROM prestamos
      WHERE ($1::estado_prestamo IS NULL OR estado = $1)
        AND ($2::bigint IS NULL OR usuario_id = $2)
      ORDER BY id LIMIT $3 OFFSET $4`,
    [estado ?? null, usuarioId ?? null, pageSize, offset],
  );
  return map.page(rows, map.prestamo, { page, pageSize });
}

async function obtener(id) {
  const { rows } = await query('SELECT * FROM prestamos WHERE id = $1', [id]);
  return rows[0] ? map.prestamo(rows[0]) : null;
}

async function bloquear(client, id) {
  const { rows } = await client.query('SELECT * FROM prestamos WHERE id = $1 FOR UPDATE', [id]);
  return rows[0] ? map.prestamo(rows[0]) : null;
}

// Un préstamo ACTIVO con fecha pasada cuenta como vencido aunque el job todavía no lo haya marcado.
async function tieneVencidos(client, usuarioId) {
  const { rowCount } = await client.query(
    `SELECT 1 FROM prestamos
      WHERE usuario_id = $1
        AND (estado = 'VENCIDO' OR (estado = 'ACTIVO' AND fecha_vencimiento < now()))
      LIMIT 1`,
    [usuarioId],
  );
  return rowCount > 0;
}

async function tieneSinDevolver(client, usuarioId, tituloId) {
  const { rowCount } = await client.query(
    "SELECT 1 FROM prestamos WHERE usuario_id = $1 AND titulo_id = $2 AND estado IN ('ACTIVO', 'VENCIDO')",
    [usuarioId, tituloId],
  );
  return rowCount > 0;
}

async function crear(client, { usuarioId, tituloId, diasPrestamo }) {
  const { rows } = await client.query(
    `INSERT INTO prestamos (usuario_id, titulo_id, fecha_vencimiento)
     VALUES ($1, $2, now() + make_interval(days => $3)) RETURNING *`,
    [usuarioId, tituloId, diasPrestamo],
  );
  return map.prestamo(rows[0]);
}

async function marcarDevuelto(client, id) {
  const { rows } = await client.query(
    "UPDATE prestamos SET estado = 'DEVUELTO', fecha_devolucion = now() WHERE id = $1 RETURNING *",
    [id],
  );
  return map.prestamo(rows[0]);
}

module.exports = {
  listar, obtener, bloquear, tieneVencidos, tieneSinDevolver, crear, marcarDevuelto,
};
