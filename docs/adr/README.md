# Architecture Decision Records

| # | Decisión |
|---|----------|
| [001](001-rest-vs-grpc.md) | REST/JSON con OpenAPI 3.1 |
| [002](002-base-de-datos-postgresql.md) | PostgreSQL + migraciones versionadas y seed idempotente |
| [003](003-seguridad-oauth2-jwt-auth0.md) | OAuth 2.0 client_credentials + JWT (Auth0) y scopes |
| [004](004-broker-rabbitmq.md) | RabbitMQ para eventos `prestamo.creado`, con reintentos y DLQ |
| [005](005-integracion-websocket.md) | WebSocket para lista de espera |
| [006](006-estilo-api.md) | Estilo y convenciones de la API (recursos, códigos HTTP, errores, paginación) |
| [007](007-observabilidad-opentelemetry.md) | Observabilidad con OpenTelemetry + Grafana LGTM (logs, métricas, trazas) |
| [008](008-estrategia-de-pruebas.md) | Pruebas: Postman/Newman, JMeter y emisor JWT local |
