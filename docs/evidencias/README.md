# Evidencias

Generadas el 2026-11-12 con el stack completo y **Auth0 real** (tenant `dev-wgynhn5mtrfjkjkz`).

| Evidencia | Archivo | Cómo se generó |
|---|---|---|
| Pruebas funcionales (Newman): 55 requests, 97/97 aserciones | [newman/newman-report.html](newman/newman-report.html) | `docker compose --profile tests run --rm newman` |
| Prueba de carga (JMeter): 8632 requests, 0 % errores, p95 15 ms | [carga/README.md](carga/README.md) · [carga/reporte/index.html](carga/reporte/index.html) | `docker compose --profile carga run --rm jmeter` |
| Datos crudos de la carga | [carga/resultados.jtl](carga/resultados.jtl) | idem |
| Dashboard durante la carga: throughput, p95, error rate | [capturas/grafana-dashboard-http.jpg](capturas/grafana-dashboard-http.jpg) | Grafana, durante la corrida de JMeter |
| Dashboard: métricas de negocio, worker y logs con correlation ID | [capturas/grafana-dashboard-negocio-worker-logs.jpg](capturas/grafana-dashboard-negocio-worker-logs.jpg) | idem |
| Traza API → RabbitMQ → worker (Tempo) | [capturas/tempo-traza-api-worker.jpg](capturas/tempo-traza-api-worker.jpg) | `POST /prestamos` con `X-Correlation-Id: evidencia-traza-0001` |
| Auth0: API, audience y scopes | [capturas/auth0-api-scopes.jpg](capturas/auth0-api-scopes.jpg) | Auth0 → APIs → Biblioteca digital → Permissions |
| Auth0: clientes M2M y permisos (cliente 6/6, lector 3/6) | [capturas/auth0-clientes-permisos.jpg](capturas/auth0-clientes-permisos.jpg) | Auth0 → APIs → Biblioteca digital → Application Access |
| Colas de RabbitMQ (principal, retry con DLX y DLQ) | [capturas/rabbitmq-colas.jpg](capturas/rabbitmq-colas.jpg) | Consola de RabbitMQ después de la carga (0 mensajes en DLQ) |
| Aviso por WebSocket con Auth0 real | [ws-cliente.txt](ws-cliente.txt) | `scripts/ws-client.js 2` mientras se devolvía el préstamo 1 |

Ningún archivo contiene tokens ni secretos: el reporte de Newman se genera con `skipSensitiveData` (verificado: 0
tokens y 0 apariciones de los client secrets), JMeter no guarda headers y las capturas no muestran *client secrets*.
