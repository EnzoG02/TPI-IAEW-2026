# Guion de la demo (7 minutos + 5 de preguntas)

Objetivo: mostrar el flujo de negocio completo, la seguridad, la asincronía y su efecto, la integración WebSocket, la
observabilidad y las pruebas, en ese orden.

## Antes de entrar (preparación, no cuenta en los 7 minutos)

```bash
docker compose up -d --build --wait
docker compose run --rm tools node scripts/reset.js    # datos de demo limpios
```

Pantallas abiertas:

1. **Terminal A** con `source .env` y la variable `TOKEN` cargada (ver README) y `H="Authorization: Bearer $TOKEN"`.
2. **Terminal B** lista para el cliente WebSocket.
3. **Postman** con la colección y el environment de Auth0 importados.
4. **Grafana** en el dashboard *Biblioteca digital* (últimos 15 min, refresco 5 s).
5. **RabbitMQ** en *Queues*.
6. Pestaña con `docs/c4/container-1.png`.

## Guion

| Min | Qué mostrar | Cómo | Qué decir |
|---|---|---|---|
| 0:00–0:45 | Arquitectura | Diagrama de contenedores | API, worker, PostgreSQL, RabbitMQ, Grafana LGTM y Auth0; todo con `docker compose up`; `migrate` aplica migraciones y seed antes de la API. |
| 0:45–2:00 | Seguridad | Postman, carpeta *01 Seguridad*: sin token → 401; token del lector en `POST /titulos` → 403 con el scope faltante; `x-api-key` → 200 | La API valida firma (JWKS), issuer, audience, expiración y scope por endpoint; el token se obtiene con `client_credentials`. La API key es solo comparación: no expira ni tiene scopes. |
| 2:00–3:30 | Transacción multi-paso | Terminal A: casos del seed (Carla 403, Diego 403, El Aleph 409) y un préstamo 201 con `X-Correlation-Id: demo-001` | Los 7 pasos van en una transacción con `SELECT … FOR UPDATE` sobre el título; los errores salen con `code` estable. |
| 3:30–4:30 | Asincronía y su efecto | `GET /avisos?prestamoId=<id>` → `PRESTAMO_CONFIRMADO`; `docker compose logs worker \| grep demo-001` | Después del commit se publica `prestamo.creado`; el worker lo consume y registra el aviso. Mismo correlation ID en API y worker. Retry y DLQ si falla. |
| 4:30–5:30 | WebSocket | Terminal B: `docker compose run --rm tools node scripts/ws-client.js 2`; Terminal A: `POST /prestamos/1/devolucion` | Bruno recibe `cupo.disponible` al instante; su reserva pasa a `NOTIFICADA` y el cupo queda guardado para él (otro usuario recibe 409). |
| 5:30–6:30 | Observabilidad | Grafana: throughput, p95, error rate, métricas de negocio; filtrar logs por `demo-001`; abrir la traza en Tempo | p95 con histogramas de OpenTelemetry; logs JSON correlacionados; la traza cruza API → RabbitMQ → worker. |
| 6:30–7:00 | Pruebas | Abrir `docs/evidencias/newman/newman-report.html` y `docs/evidencias/carga/reporte/index.html` | Colección completa en verde y prueba de carga con p95 y throughput; las dos se reproducen con un comando. |

## Preguntas probables (respuestas cortas)

- **¿Por qué el 403 de usuario bloqueado y el de scope usan el mismo código HTTP?** Ambos son "autenticado pero no
  autorizado"; se distinguen por `code` (`USUARIO_BLOQUEADO` vs. `SIN_PERMISO`). ADR 006.
- **¿Qué pasa si se cae RabbitMQ?** El préstamo se crea igual y se loguea `evento.publicacion_fallida`; la API se
  reconecta sola. Limitación conocida: sin outbox ese evento se pierde. ADR 004.
- **¿Y si el worker procesa dos veces el mismo evento?** Índice único `avisos(prestamo_id, tipo)` + `ON CONFLICT DO NOTHING`.
- **¿Cómo evitan que dos préstamos tomen el último cupo?** `SELECT … FOR UPDATE` sobre el título dentro de la
  transacción, más el `CHECK` de cupo y el índice único parcial en la base.
- **¿Por qué WebSocket y no webhook?** Es la opción que propone el dominio y es visible en tiempo real. ADR 005.
- **¿Por qué el token lleva `usuarioId` en el body?** El token M2M identifica a la aplicación, no al lector.
- **¿Cómo se valida el token del WebSocket si el navegador no manda headers?** Los clientes son M2M y sí los mandan;
  para navegador se usaría el header `Sec-WebSocket-Protocol`. ADR 005.
- **¿Por qué OpenTelemetry + otel-lgtm?** Métricas, logs y trazas correlacionados en una sola herramienta, igual que
  en la clase 07. ADR 007.

## Plan B

- Si Auth0 no responde (sin internet): `docker compose -f docker-compose.yml -f compose.local-auth.yaml up -d --wait`
  y usar el environment `local-auth` en Postman (emisor JWT local, misma validación en la API).
- Si Docker tarda en levantar: tener el stack ya arriba antes de entrar y las evidencias abiertas.
