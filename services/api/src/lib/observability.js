// Logs JSON, correlation ID, trazas y métricas HTTP. Adaptado del laboratorio de la clase 07.
const crypto = require('node:crypto');
const {
  context, trace, metrics, propagation, SpanKind, SpanStatusCode, createContextKey, ROOT_CONTEXT,
} = require('@opentelemetry/api');
const { logs, SeverityNumber } = require('@opentelemetry/api-logs');

const SERVICE = process.env.OTEL_SERVICE_NAME || 'biblioteca-api';
const CORRELATION = createContextKey('biblioteca.correlation');
const CORRELATION_HEADER = 'x-correlation-id';
const CORRELATION_FORMAT = /^[A-Za-z0-9._:-]{8,128}$/;

const tracer = trace.getTracer(SERVICE);
const meter = metrics.getMeter(SERVICE);
const otelLogger = logs.getLogger(SERVICE);

const httpRequests = meter.createCounter('biblioteca_http_requests', {
  description: 'Respuestas HTTP por ruta, método y estado',
});
const httpDuration = meter.createHistogram('biblioteca_http_duration', {
  unit: 's', description: 'Duración de las requests HTTP',
});

function correlationId() {
  return context.active().getValue(CORRELATION);
}

// Log estructurado: stdout (docker compose logs) + OTLP (Loki).
function log(event, fields = {}, level = 'info') {
  const spanContext = trace.getSpan(context.active())?.spanContext();
  const record = {
    timestamp: new Date().toISOString(),
    level,
    'service.name': SERVICE,
    event,
    correlation_id: correlationId(),
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

async function withSpan(name, attributes, operation, kind = SpanKind.INTERNAL) {
  return tracer.startActiveSpan(name, { attributes, kind }, async (span) => {
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

// Headers AMQP con traceparent + correlation ID, para seguir la operación hasta el worker.
function messageHeaders(extra = {}) {
  const headers = { ...extra };
  propagation.inject(context.active(), headers);
  const correlation = correlationId();
  if (correlation) headers[CORRELATION_HEADER] = correlation;
  return headers;
}

// Ruta normalizada para las métricas (/titulos/5 -> /titulos/:id) sin explotar la cardinalidad:
// las rutas inexistentes (404 RUTA_NO_ENCONTRADA) se agrupan en "sin_ruta".
function routeOf(req, res) {
  if (res.locals.sinRuta) return 'sin_ruta';
  const path = req.originalUrl.split('?')[0].replace(/\/\d+(?=\/|$)/g, '/:id').replace(/\/$/, '');
  return path || '/';
}

// Middleware HTTP: respeta X-Correlation-Id si es válido, si no genera uno (ADR 006).
function observeHttp(req, res, next) {
  const incoming = req.get(CORRELATION_HEADER);
  const correlation = incoming && CORRELATION_FORMAT.test(incoming) ? incoming : crypto.randomUUID();
  const parent = propagation.extract(ROOT_CONTEXT, req.headers).setValue(CORRELATION, correlation);
  // Healthchecks y archivos de Swagger UI no cuentan para las métricas ni el log de requests.
  const quiet = req.path === '/health' || req.path.startsWith('/api-docs');

  tracer.startActiveSpan(`${req.method} ${req.path}`, { kind: SpanKind.SERVER }, parent, (span) => {
    const start = performance.now();
    res.set('X-Correlation-Id', correlation);
    res.set('X-Trace-Id', span.spanContext().traceId);
    res.once('finish', () => {
      const route = routeOf(req, res);
      const seconds = (performance.now() - start) / 1000;
      const attrs = { route, method: req.method, status: String(res.statusCode) };
      span.updateName(`${req.method} ${route}`);
      span.setAttributes({
        'http.request.method': req.method, 'http.route': route, 'http.response.status_code': res.statusCode,
      });
      if (res.statusCode >= 500) span.setStatus({ code: SpanStatusCode.ERROR });
      if (!quiet) {
        httpRequests.add(1, attrs);
        httpDuration.record(seconds, attrs);
        context.with(trace.setSpan(parent, span), () => log('http.request', {
          ...attrs, duration_ms: Math.round(seconds * 1000),
        }, res.statusCode >= 500 ? 'error' : 'info'));
      }
      span.end();
    });
    next();
  });
}

module.exports = {
  CORRELATION, correlationId, log, withSpan, messageHeaders, observeHttp, meter, SpanKind,
};
