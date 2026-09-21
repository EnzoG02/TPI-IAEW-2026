// Placeholder de la Entrega 1. En la Entrega 2 consume "prestamo.creado" desde RabbitMQ
// (amqplib) para gestionar vencimientos, multas y avisos de devolución.
const log = (level, msg, extra = {}) =>
  console.log(JSON.stringify({ ts: new Date().toISOString(), level, service: 'worker', msg, ...extra }));

log('info', 'hello from biblioteca-worker');
setInterval(() => log('info', 'worker vivo (placeholder)'), 30000);
