// Pool de PostgreSQL y helper de transacciones.
const { Pool } = require('pg');
const config = require('../config');

const pool = new Pool({ connectionString: config.databaseUrl, max: 10 });

function query(text, params) {
  return pool.query(text, params);
}

// Ejecuta fn(client) dentro de BEGIN/COMMIT; ante cualquier error hace ROLLBACK y relanza.
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Códigos de error de PostgreSQL que la API traduce a errores de dominio.
const PG = { UNIQUE_VIOLATION: '23505', FOREIGN_KEY_VIOLATION: '23503' };

module.exports = { pool, query, withTransaction, PG };
