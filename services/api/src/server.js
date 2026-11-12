// Punto de entrada: servidor HTTP con la app Express y el gateway WebSocket en el mismo puerto.
const http = require('node:http');
const config = require('./config');
const app = require('./app');
const listaEspera = require('./ws/listaEspera');
const { pool } = require('./lib/db');
const { closeRabbit, getChannel } = require('./lib/rabbit');
const { log } = require('./lib/observability');
require('./metrics');

const server = http.createServer(app);
listaEspera.attach(server);

server.listen(config.port, () => {
  log('api.iniciada', { port: config.port, ws: listaEspera.PATH });
  // Conexión temprana al broker; si falla se reintenta en la primera publicación.
  getChannel().catch((error) => log('rabbit.no_disponible', { error_message: error.message }, 'warn'));
});

async function shutdown(signal) {
  log('api.deteniendo', { signal });
  listaEspera.cerrar();
  server.close();
  await closeRabbit();
  await pool.end();
  const sdk = require('./telemetry');
  await sdk.shutdown().catch(() => {});
  process.exit(0);
}

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));
