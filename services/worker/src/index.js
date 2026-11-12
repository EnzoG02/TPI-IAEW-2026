// Worker: consume prestamo.creado desde RabbitMQ y corre el job de vencimientos.
const { context } = require('@opentelemetry/api');
const { Pool } = require('pg');
const rabbit = require('./rabbit');
const { processMessage, retryCountOf } = require('./consumer');
const vencimientos = require('./vencimientos');
const {
  log, withSpan, messageContext, jobContext, attempts, workerDuration, vencimientos: vencimientosCounter, SpanKind,
} = require('./observability');

function intEnv(name, fallback) {
  const value = process.env[name] === undefined || process.env[name] === '' ? fallback : Number(process.env[name]);
  if (!Number.isInteger(value) || value < 0) throw new Error(`${name} debe ser un entero >= 0`);
  return value;
}

const config = {
  databaseUrl: process.env.DATABASE_URL,
  rabbitUrl: process.env.RABBITMQ_URL,
  maxRetries: intEnv('MAX_RETRIES', 3),
  retryDelayMs: intEnv('RETRY_DELAY_MS', 5000),
  simulatedFailures: intEnv('SIMULATE_TRANSIENT_FAILURES', 0),
  vencimientosIntervalMs: intEnv('VENCIMIENTOS_INTERVAL_MS', 60000),
  multaMonto: intEnv('MULTA_MONTO', 500),
};

const db = new Pool({ connectionString: config.databaseUrl, max: 5 });
let connection;

async function consumir(message, channel) {
  return withSpan('consumir prestamo.creado', {
    'messaging.system': 'rabbitmq', 'messaging.destination.name': rabbit.QUEUE,
    'event.id': message.properties.messageId || '', 'retry.count': retryCountOf(message),
  }, async () => {
    const start = performance.now();
    let result = 'error';
    try {
      result = await processMessage(message, channel, {
        db, log, config, publishRetry: rabbit.publishRetry, publishDlq: rabbit.publishDlq,
      });
      return result;
    } finally {
      attempts.add(1, { result });
      workerDuration.record((performance.now() - start) / 1000, { result });
    }
  }, messageContext(message.properties.headers), SpanKind.CONSUMER);
}

async function correrVencimientos() {
  await context.with(jobContext(), () => withSpan('job vencimientos', {}, async () => {
    try {
      const r = await vencimientos.ejecutar(db, config);
      if (r.vencidos) vencimientosCounter.add(r.vencidos);
      if (r.recordatorios || r.vencidos || r.avisosVencimiento || r.multas) log('vencimientos.procesados', r);
    } catch (error) {
      log('vencimientos.error', { error_message: error.message }, 'error');
    }
  }));
}

async function conectarConReintentos() {
  for (let intento = 1; ; intento += 1) {
    try {
      return await rabbit.connect(config.rabbitUrl, config.retryDelayMs);
    } catch (error) {
      log('rabbit.no_disponible', { intento, error_message: error.message }, 'warn');
      await new Promise((resolve) => setTimeout(resolve, Math.min(1000 * intento, 10000)));
    }
  }
}

async function start() {
  const conexion = await conectarConReintentos();
  connection = conexion.connection;
  const { channel } = conexion;
  channel.on('error', (error) => log('rabbit.canal_error', { error_message: error.message }, 'error'));
  connection.on('close', () => {
    log('rabbit.conexion_cerrada', {}, 'error');
    process.exit(1); // docker compose lo reinicia (restart: unless-stopped)
  });
  await channel.prefetch(1);
  await channel.consume(rabbit.QUEUE, (message) => {
    if (message) {
      consumir(message, channel).catch((error) => log('evento.sin_ack', { error_message: error.message }, 'error'));
    }
  }, { noAck: false });
  log('worker.iniciado', {
    queue: rabbit.QUEUE, max_retries: config.maxRetries, retry_delay_ms: config.retryDelayMs,
    vencimientos_interval_ms: config.vencimientosIntervalMs,
  });

  await correrVencimientos();
  setInterval(correrVencimientos, config.vencimientosIntervalMs);
}

async function shutdown() {
  log('worker.deteniendo');
  connection?.removeAllListeners('close');
  await connection?.close().catch(() => {});
  await db.end();
  await require('./telemetry').shutdown().catch(() => {});
  process.exit(0);
}

process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);

start().catch((error) => {
  log('worker.error_inicio', { error_message: error.message }, 'error');
  process.exit(1);
});
