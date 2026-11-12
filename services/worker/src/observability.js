// Logs JSON con correlation ID, spans y métricas del worker. Adaptado del laboratorio de la clase 07.
const crypto = require('node:crypto');
const {
  context, trace, metrics, propagation, SpanKind, SpanStatusCode, createContextKey, ROOT_CONTEXT,
} = require('@opentelemetry/api');
const { logs, SeverityNumber } = require('@opentelemetry/api-logs');

const SERVICE = process.env.OTEL_SERVICE_NAME || 'biblioteca-worker';
const CORRELATION = createContextKey('biblioteca.correlation');
const tracer = trace.getTracer(SERVICE);
const meter = metrics.getMeter(SERVICE);
const otelLogger = logs.getLogger(SERVICE);

const attempts = meter.createCounter('biblioteca_worker_attempts', {
  description: 'Intentos de procesamiento de eventos por resultado',
});
const workerDuration = meter.createHistogram('biblioteca_worker_duration', {
  unit: 's', description: 'Duración de un intento del worker',
});
const vencimientos = meter.createCounter('biblioteca_vencimientos', {
  description: 'Préstamos marcados como VENCIDO por el job',
});

function log(event, fields = {}, level = 'info') {
  const spanContext = trace.getSpan(context.active())?.spanContext();
  const record = {
    timestamp: new Date().toISOString(),
    level,
    'service.name': SERVICE,
    event,
    correlation_id: context.active().getValue(CORRELATION),
    trace_id: spanContext?.traceId,
    span_id: spanContext?.spanId,
    ...fields,
  };
  console.log(JSON.stringify(record));
  otelLogger.emit({
    body: JSON.stringify(record),
    severityText: level.toUpperCase(),
    severityNumber: level === 'error' ? SeverityNumber.ERROR : level === 'warn' ? SeverityNumber.WARN : SeverityNumber.INFO,
    attributes: { event, correlation_id: record.correlation_id, ...fields },
    context: context.active(),
  });
}

async function withSpan(name, attributes, operation, parent = context.active(), kind = SpanKind.INTERNAL) {
  return tracer.startActiveSpan(name, { attributes, kind }, parent, async (span) => {
    try {
      return await operation(span);
    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      throw error;
    } finally {
      span.end();
    }
  });
}

// Contexto de un mensaje AMQP: continúa la traza de la API y recupera su correlation ID.
function messageContext(headers = {}) {
  return propagation.extract(ROOT_CONTEXT, headers)
    .setValue(CORRELATION, headers['x-correlation-id'] || crypto.randomUUID());
}

// Contexto para el job periódico (no viene de un request).
function jobContext() {
  return ROOT_CONTEXT.setValue(CORRELATION, `job-${crypto.randomUUID()}`);
}

function messageHeaders(extra = {}) {
  const headers = { ...extra };
  propagation.inject(context.active(), headers);
  const correlation = context.active().getValue(CORRELATION);
  if (correlation) headers['x-correlation-id'] = correlation;
  return headers;
}

module.exports = {
  log, withSpan, messageContext, jobContext, messageHeaders, attempts, workerDuration, vencimientos, SpanKind,
};
