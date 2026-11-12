// Migraciones versionadas y seed idempotente (ADR 002).
// - Cada archivo de db/migrations se aplica una sola vez, en orden, dentro de una transacción,
//   y queda registrado en la tabla schema_migrations.
// - El seed solo se carga si la base no tiene usuarios (se puede correr muchas veces).
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

const DB_DIR = [
  process.env.DB_DIR,
  path.resolve(__dirname, '../db'), // imagen Docker: /app/db
  path.resolve(__dirname, '../../../db'), // repo: db/
].filter(Boolean).find((dir) => fs.existsSync(path.join(dir, 'migrations')));

const log = (event, fields = {}) =>
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), level: 'info', 'service.name': 'biblioteca-migrate', event, ...fields }));

async function connect() {
  if (!DB_DIR) throw new Error('No se encontró la carpeta db/migrations');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  return client;
}

async function migrate(client) {
  await client.query('SELECT pg_advisory_lock(424242)'); // evita dos migraciones en paralelo
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
    const { rows } = await client.query('SELECT version FROM schema_migrations');
    const aplicadas = new Set(rows.map((r) => r.version));
    const archivos = fs.readdirSync(path.join(DB_DIR, 'migrations')).filter((f) => f.endsWith('.sql')).sort();
    for (const archivo of archivos) {
      if (aplicadas.has(archivo)) continue;
      const sql = fs.readFileSync(path.join(DB_DIR, 'migrations', archivo), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [archivo]);
        await client.query('COMMIT');
        log('migracion.aplicada', { version: archivo });
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(`Falló la migración ${archivo}: ${error.message}`);
      }
    }
    log('migraciones.al_dia', { total: archivos.length });
  } finally {
    await client.query('SELECT pg_advisory_unlock(424242)');
  }
}

async function seed(client) {
  const { rows } = await client.query('SELECT count(*)::int AS n FROM usuarios');
  if (rows[0].n > 0) {
    log('seed.omitido', { motivo: 'la base ya tiene datos' });
    return;
  }
  const sql = fs.readFileSync(path.join(DB_DIR, 'seed.sql'), 'utf8');
  await client.query('BEGIN');
  try {
    await client.query(sql);
    await client.query('COMMIT');
    log('seed.aplicado');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

// Borra todo el esquema y lo recrea: deja la base como recién levantada (datos de demo incluidos).
async function reset(client) {
  await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  log('db.reseteada');
  await migrate(client);
  await seed(client);
}

async function run(steps) {
  const client = await connect();
  try {
    for (const step of steps) await step(client);
  } finally {
    await client.end();
  }
}

function main(steps) {
  run(steps).catch((error) => {
    console.error(JSON.stringify({ level: 'error', 'service.name': 'biblioteca-migrate', event: 'migrate.error', error_message: error.message }));
    process.exit(1);
  });
}

module.exports = { migrate, seed, reset, main };
