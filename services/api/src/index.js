// Placeholder de la Entrega 1: servicio "hello" sin dependencias.
// En la Entrega 2 se reemplaza por Express + JWT + PostgreSQL + RabbitMQ.
const http = require('http');

const PORT = process.env.API_PORT || 3000;

const log = (level, msg, extra = {}) =>
  console.log(JSON.stringify({ ts: new Date().toISOString(), level, service: 'api', msg, ...extra }));

const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.url === '/health') {
    res.end(JSON.stringify({ status: 'ok', service: 'api' }));
  } else {
    res.end(JSON.stringify({ message: 'hello from biblioteca-api' }));
  }
  log('info', 'request', { method: req.method, url: req.url });
});

server.listen(PORT, () => log('info', `api escuchando en puerto ${PORT}`));
