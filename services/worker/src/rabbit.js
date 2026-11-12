// Topología de RabbitMQ del consumidor (ADR 004). Adaptada del laboratorio de la clase 07.
//
//   biblioteca.eventos (topic) --prestamo.creado--> worker.prestamos
//   falla transitoria: biblioteca.eventos.retry --> worker.prestamos.retry (espera RETRY_DELAY_MS) --vuelve--> biblioteca.eventos
//   falla permanente o reintentos agotados: biblioteca.eventos.dlx --> worker.prestamos.dlq
const amqp = require('amqplib');
const { messageHeaders } = require('./observability');

const EXCHANGE = 'biblioteca.eventos';
const ROUTING_KEY = 'prestamo.creado';
const QUEUE = 'worker.prestamos';
const RETRY_EXCHANGE = 'biblioteca.eventos.retry';
const RETRY_QUEUE = 'worker.prestamos.retry';
const DLX = 'biblioteca.eventos.dlx';
const DLQ = 'worker.prestamos.dlq';

// El TTL del reintento va en cada mensaje (expiration) y no como argumento de la cola:
// así se puede cambiar RETRY_DELAY_MS sin que RabbitMQ rechace la redeclaración (406).
let retryDelayMs = 5000;

async function connect(url, delayMs) {
  retryDelayMs = delayMs;
  const connection = await amqp.connect(url);
  // Sin listener, un error de la conexión tumba el proceso; así se reintenta con logs JSON.
  connection.on('error', () => {});
  const channel = await connection.createConfirmChannel();
  channel.on('error', () => {});
  await channel.assertExchange(EXCHANGE, 'topic', { durable: true });
  await channel.assertExchange(RETRY_EXCHANGE, 'direct', { durable: true });
  await channel.assertExchange(DLX, 'direct', { durable: true });
  await channel.assertQueue(QUEUE, { durable: true });
  await channel.bindQueue(QUEUE, EXCHANGE, ROUTING_KEY);
  await channel.assertQueue(RETRY_QUEUE, {
    durable: true,
    arguments: {
      'x-dead-letter-exchange': EXCHANGE,
      'x-dead-letter-routing-key': ROUTING_KEY,
    },
  });
  await channel.bindQueue(RETRY_QUEUE, RETRY_EXCHANGE, ROUTING_KEY);
  await channel.assertQueue(DLQ, { durable: true });
  await channel.bindQueue(DLQ, DLX, ROUTING_KEY);
  return { connection, channel };
}

async function confirmedPublish(channel, exchange, message, headers, extra = {}) {
  const accepted = channel.publish(exchange, ROUTING_KEY, message.content, {
    ...message.properties, persistent: true, headers: messageHeaders(headers), ...extra,
  });
  if (!accepted) throw new Error('RabbitMQ aplicó back-pressure');
  await channel.waitForConfirms();
}

function publishRetry(channel, message, retryCount, reason) {
  return confirmedPublish(channel, RETRY_EXCHANGE, message, {
    ...(message.properties.headers || {}), 'x-retry-count': retryCount, 'x-last-error': reason,
  }, { expiration: String(retryDelayMs) });
}

function publishDlq(channel, message, reason, retryCount) {
  return confirmedPublish(channel, DLX, message, {
    ...(message.properties.headers || {}), 'x-retry-count': retryCount, 'x-dlq-reason': reason,
  }, { expiration: undefined });
}

module.exports = { connect, publishRetry, publishDlq, QUEUE, DLQ, RETRY_QUEUE };
