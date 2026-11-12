const { query } = require('../lib/db');
const map = require('./mappers');

async function listar({ autor, soloDisponibles, page, pageSize, offset }) {
  const { rows } = await query(
    `SELECT *, count(*) OVER () AS total FROM titulos
      WHERE ($1::text IS NULL OR autor ILIKE '%' || $1 || '%')
        AND ($2::boolean IS NOT TRUE OR cupo_disponible > 0)
      ORDER BY id LIMIT $3 OFFSET $4`,
    [autor ?? null, soloDisponibles ?? null, pageSize, offset],
  );
  return map.page(rows, map.titulo, { page, pageSize });
}

async function obtener(id, client = { query }) {
  const { rows } = await client.query('SELECT * FROM titulos WHERE id = $1', [id]);
  return rows[0] ? map.titulo(rows[0]) : null;
}

async function crear({ titulo, autor, isbn, cupoTotal }) {
  const { rows } = await query(
    `INSERT INTO titulos (titulo, autor, isbn, cupo_total, cupo_disponible)
     VALUES ($1, $2, $3, $4, $4) RETURNING *`,
    [titulo, autor, isbn ?? null, cupoTotal],
  );
  return map.titulo(rows[0]);
}

async function bloquear(client, id) {
  const { rows } = await client.query('SELECT * FROM titulos WHERE id = $1 FOR UPDATE', [id]);
  return rows[0] ? map.titulo(rows[0]) : null;
}

async function prestamosSinDevolver(client, id) {
  const { rows } = await client.query(
    "SELECT count(*)::int AS n FROM prestamos WHERE titulo_id = $1 AND estado IN ('ACTIVO', 'VENCIDO')",
    [id],
  );
  return rows[0].n;
}

async function actualizar(client, id, { titulo, autor, isbn, cupoTotal, cupoDisponible }) {
  const { rows } = await client.query(
    `UPDATE titulos SET titulo = $2, autor = $3, isbn = $4, cupo_total = $5, cupo_disponible = $6
      WHERE id = $1 RETURNING *`,
    [id, titulo, autor, isbn ?? null, cupoTotal, cupoDisponible],
  );
  return map.titulo(rows[0]);
}

async function ajustarCupo(client, id, delta) {
  await client.query('UPDATE titulos SET cupo_disponible = cupo_disponible + $2 WHERE id = $1', [id, delta]);
}

async function eliminar(id) {
  const { rowCount } = await query('DELETE FROM titulos WHERE id = $1', [id]);
  return rowCount > 0;
}

module.exports = {
  listar, obtener, crear, bloquear, prestamosSinDevolver, actualizar, ajustarCupo, eliminar,
};
