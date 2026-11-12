const { query } = require('../lib/db');
const map = require('./mappers');

async function listar({ estado, page, pageSize, offset }) {
  const { rows } = await query(
    `SELECT *, count(*) OVER () AS total FROM usuarios
      WHERE ($1::estado_usuario IS NULL OR estado = $1)
      ORDER BY id LIMIT $2 OFFSET $3`,
    [estado ?? null, pageSize, offset],
  );
  return map.page(rows, map.usuario, { page, pageSize });
}

async function obtener(id, client = { query }) {
  const { rows } = await client.query('SELECT * FROM usuarios WHERE id = $1', [id]);
  return rows[0] ? map.usuario(rows[0]) : null;
}

async function crear({ nombre, email, estado }) {
  const { rows } = await query(
    'INSERT INTO usuarios (nombre, email, estado) VALUES ($1, $2, $3) RETURNING *',
    [nombre, email, estado ?? 'HABILITADO'],
  );
  return map.usuario(rows[0]);
}

// Si el body no trae `estado`, se conserva el actual (documentado en el contrato).
async function actualizar(id, { nombre, email, estado }) {
  const { rows } = await query(
    `UPDATE usuarios SET nombre = $2, email = $3, estado = COALESCE($4::estado_usuario, estado)
      WHERE id = $1 RETURNING *`,
    [id, nombre, email, estado ?? null],
  );
  return rows[0] ? map.usuario(rows[0]) : null;
}

async function eliminar(id) {
  const { rowCount } = await query('DELETE FROM usuarios WHERE id = $1', [id]);
  return rowCount > 0;
}

module.exports = { listar, obtener, crear, actualizar, eliminar };
