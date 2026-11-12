// Productor de eventos: publica prestamo.creado en el exchange biblioteca.eventos (ADR 004).
// Usa un confirm channel: la publicación se considera hecha cuando el broker la confirma.
// La topología de colas (principal, retry y DLQ) la declara el worker, que es su dueño.
const amqp = require('amqplib');
const crypto = require('node:crypto');
const config = require('../config');
const { log, withSpan, messageHeaders, correlationId, SpanKind } = require('./observability');

const EXCHANGE = 'biblioteca.eventos';
let connection;
let channelPromise;

async function getChannel() {
  if (!channelPromise) {
    channelPromise = (async () => {
      connection = await amqp.connect(config.rabbitUrl);
      connection.on('error', (error) => log('rabbit.error', { error_message: error.message }, 'warn'));
      connection.on('close', () => { connection = undefined; channelPromise = undefined; });
      const channel = await connection.createConfirmChannel();
      await channel.assertExchange(EXCHANGE, 'topic', { durable: true });
      return channel;
    })().catch((error) => {
      channelPromise = undefined;
      throw error;
    });
  }
  return channelPromise;
}

async function publish(routingKey, data) {
  const event = {
    eventId: crypto.randomUUID(),
    type: routingKey,
    occurredAt: new Date().toISOString(),
    correlationId: correlationId(),
    data,
  };
  await withSpan(`publicar ${routingKey}`, {
    'messaging.system': 'rabbitmq', 'messaging.destination.name': EXCHANGE, 'event.id': event.eventId,
  }, async () => {
    const channel = await getChannel();
    const accepted = channel.publish(EXCHANGE, routingKey, Buffer.from(JSON.stringify(event)), {
      contentType: 'application/json',
      persistent: true,
      messageId: event.eventId,
      type: routingKey,
      headers: messageHeaders({ 'x-retry-count': 0 }),
    });
    if (!accepted) throw new Error('RabbitMQ aplicó back-pressure');
    await channel.waitForConfirms();
  }, SpanKind.PRODUCER);
  log('evento.publicado', { event_type: routingKey, event_id: event.eventId });
  return event;
}

// Se llama después del COMMIT. Si el broker no está disponible el préstamo ya existe:
// se registra el error y no se rompe la respuesta (limitación documentada en ADR 004).
async function publishSafely(routingKey, data) {
  try {
    return await publish(routingKey, data);
  } catch (error) {
    log('evento.publicacion_fallida', { event_type: routingKey, error_message: error.message }, 'error');
    return null;
  }
}

async function closeRabbit() {
  const active = connection;
  connection = undefined;
  channelPromise = undefined;
  if (active) await active.close().catch(() => {});
}

module.exports = { EXCHANGE, publish, publishSafely, closeRabbit, getChannel };
