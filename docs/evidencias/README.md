# Evidencias

| Evidencia | Archivo | Cómo se generó |
|---|---|---|
| Pruebas funcionales (Newman) | [newman/newman-report.html](newman/newman-report.html) | `docker compose --profile tests run --rm newman` |
| Prueba de carga (JMeter) | [carga/reporte/index.html](carga/reporte/index.html) · [resumen](carga/README.md) | `docker compose --profile carga run --rm jmeter` |
| Datos crudos de la carga | [carga/resultados.jtl](carga/resultados.jtl) | idem |
| Dashboard de Grafana durante la carga | [capturas/grafana-dashboard.png](capturas/grafana-dashboard.png) | captura manual |
| Traza API → RabbitMQ → worker (Tempo) | [capturas/grafana-traza.png](capturas/grafana-traza.png) | captura manual |
| Logs filtrados por correlation ID (Loki) | [capturas/grafana-logs-correlation.png](capturas/grafana-logs-correlation.png) | captura manual |
| Configuración de Auth0 (API, scopes, clientes M2M) | [capturas/auth0-api-scopes.png](capturas/auth0-api-scopes.png) · [capturas/auth0-clientes.png](capturas/auth0-clientes.png) | captura manual |
| Colas de RabbitMQ (principal, retry y DLQ) | [capturas/rabbitmq-colas.png](capturas/rabbitmq-colas.png) | captura manual |
| Aviso por WebSocket | [ws-cliente.txt](ws-cliente.txt) | salida de `scripts/ws-client.js` durante una devolución |

Ningún archivo contiene tokens ni secretos: el reporte de Newman se genera con `skipSensitiveData`, JMeter no guarda
headers y las capturas se toman sin mostrar los *client secrets*.
