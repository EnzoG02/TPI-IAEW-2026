# ADR 007 – Observabilidad: OpenTelemetry + Grafana LGTM

- **Estado:** Aceptado (reemplaza la idea de "Prometheus + Grafana con prom-client" del C4 de la Entrega 1)
- **Fecha:** 2026-11

## Contexto
La consigna pide logs JSON, correlation ID y un dashboard con latencia p95, throughput y tasa de errores. El dominio
pide además métricas de préstamos activos y vencidos, reservas en espera y avisos enviados. El flujo de un préstamo
cruza dos procesos (API → RabbitMQ → worker), así que también conviene poder seguir una operación de punta a punta.

## Decisión
- **Instrumentación con OpenTelemetry** (SDK de Node) en la API y en el worker (`src/telemetry.js`, precargado con
  `node --require`). Se exportan **trazas, logs y métricas por OTLP/HTTP**.
- **Backend `grafana/otel-lgtm`**: una sola imagen con OpenTelemetry Collector, Prometheus (métricas), Loki (logs),
  Tempo (trazas) y Grafana. El datasource y el dashboard se **provisionan** desde `observabilidad/`, así que aparecen
  solos al levantar el stack (Grafana en `http://localhost:3001`).
- **Logs JSON** por stdout (los ve `docker compose logs`) y por OTLP (Loki), con `timestamp`, `level`,
  `service.name`, `event`, `correlation_id`, `trace_id` y `span_id`.
- **Correlation ID**: se respeta el header `X-Correlation-Id` si es válido o se genera un UUID; se devuelve en la
  respuesta, va en los errores, en los headers AMQP (`x-correlation-id`) y en los mensajes WebSocket. El contexto de
  traza (`traceparent`) también viaja en el mensaje: en Tempo se ve un solo trace con el request HTTP, la publicación y
  el consumo del worker.
- **Métricas**:

| Métrica (Prometheus) | Tipo | Para qué |
|---|---|---|
| `biblioteca_http_requests_total{route,method,status}` | contador | throughput y error rate (4xx/5xx) |
| `biblioteca_http_duration_seconds_bucket{route,method,status}` | histograma (buckets explícitos) | latencia p95/p50 con `histogram_quantile` |
| `biblioteca_prestamos_activos`, `biblioteca_prestamos_vencidos`, `biblioteca_reservas_en_espera` | gauge (se consulta a la base cada 5 s) | métricas de negocio |
| `biblioteca_avisos{tipo}` | gauge | avisos enviados por tipo |
| `biblioteca_worker_attempts_total{result}`, `biblioteca_worker_duration_seconds_bucket` | contador / histograma | procesado, duplicado, reintento o DLQ, y latencia del worker |

- Las rutas se normalizan (`/titulos/5` → `/titulos/:id`) y las inexistentes se agrupan en `sin_ruta`, para no
  explotar la cardinalidad. `/health` y `/api-docs` no se cuentan.

## Alternativas consideradas
- **prom-client + Prometheus + Grafana por separado** (plan de la E1): resuelve métricas, pero los logs y las trazas
  quedarían afuera o con otro stack. Son tres contenedores más para configurar.
- **Jaeger** para trazas: válido, pero Tempo ya viene integrado con Grafana y Loki (de un log se salta a su traza).
- Es el mismo enfoque del laboratorio de la clase 07, lo que reduce el riesgo de configuración.

## Consecuencias
- (+) Métricas, logs y trazas correlacionados en una sola herramienta; el dashboard se versiona como código.
- (+) Cubre el opcional de trazas con OpenTelemetry.
- (−) `otel-lgtm` es una imagen pensada para desarrollo y demo (todo en un contenedor, sin alta disponibilidad);
  usa alrededor de 1 GB de RAM.
- (−) Las métricas de negocio se calculan consultando la base cada 5 s; con mucho volumen convendría contadores
  incrementados por la aplicación.
