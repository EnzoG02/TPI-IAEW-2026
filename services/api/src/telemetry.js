// OpenTelemetry: trazas, logs y métricas por OTLP hacia grafana/otel-lgtm (ver ADR 007).
// Se precarga antes de la app: node --require ./src/telemetry.js src/server.js
// Adaptado del laboratorio de la clase 07. Con OTEL_SDK_DISABLED=true no exporta nada.
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { resourceFromAttributes } = require('@opentelemetry/resources');
const { BatchLogRecordProcessor } = require('@opentelemetry/sdk-logs');
const { PeriodicExportingMetricReader, AggregationType } = require('@opentelemetry/sdk-metrics');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { OTLPLogExporter } = require('@opentelemetry/exporter-logs-otlp-http');
const { OTLPMetricExporter } = require('@opentelemetry/exporter-metrics-otlp-http');

const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://otel-lgtm:4318';

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    'service.name': process.env.OTEL_SERVICE_NAME || 'biblioteca-api',
    'service.namespace': 'biblioteca',
    'service.version': '1.0.0',
    'deployment.environment.name': 'local',
  }),
  // Buckets explícitos para que histogram_quantile calcule el p95 con buena resolución.
  views: ['biblioteca_http_duration'].map((instrumentName) => ({
    instrumentName,
    aggregation: {
      type: AggregationType.EXPLICIT_BUCKET_HISTOGRAM,
      options: { boundaries: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5], recordMinMax: true },
    },
  })),
  traceExporter: new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }),
  logRecordProcessors: [
    new BatchLogRecordProcessor({ exporter: new OTLPLogExporter({ url: `${endpoint}/v1/logs` }), scheduledDelayMillis: 1000 }),
  ],
  metricReaders: [
    new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({ url: `${endpoint}/v1/metrics` }),
      exportIntervalMillis: 5000,
    }),
  ],
});

sdk.start();

module.exports = sdk;
