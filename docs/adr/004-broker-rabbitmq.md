# ADR 004 – Asincronía: RabbitMQ (productor → broker → consumidor)

- **Estado:** Aceptado
- **Fecha:** 2026-09

## Contexto
Al crearse un préstamo deben gestionarse vencimientos, multas y avisos de devolución sin bloquear la respuesta HTTP.

## Decisión
Se usa **RabbitMQ**. La API (productor) publica `prestamo.creado` en un exchange; el worker (consumidor) lo procesa desde una cola durable, con ack manual y reintentos. Efecto visible: filas en la tabla `avisos` y logs del worker.

| Elemento | Valor |
|---|---|
| Exchange | `biblioteca.eventos` (topic, durable) |
| Routing key | `prestamo.creado` |
| Cola | `worker.prestamos` (durable) → tras 3 reintentos fallidos pasa a `worker.prestamos.dlq` |
| Payload | schema `EventoPrestamoCreado` en `api/openapi.yaml` (`eventId`, `occurredAt`, `correlationId`, `data`) |

**Qué hace el worker**
- Al recibir `prestamo.creado`: registra el aviso `PRESTAMO_CONFIRMADO` (canal `LOG`).
- Job periódico (cada minuto en la demo): registra `RECORDATORIO_DEVOLUCION` para préstamos que vencen en
  menos de 24 h y marca como `VENCIDO` los préstamos `ACTIVO` con `fecha_vencimiento` pasada, generando el aviso
  `VENCIMIENTO` y una `multa`. Se eligió un job sobre la base en lugar de mensajes diferidos (TTL + dead-letter)
  porque el vencimiento puede estar a semanas y la base ya es la fuente de verdad.

**Idempotencia:** los índices únicos `avisos(prestamo_id, tipo)` y `multas(prestamo_id)` hacen que procesar dos
veces el mismo evento no duplique registros (`INSERT ... ON CONFLICT DO NOTHING`).

**Publicación después del commit:** la API publica el evento después de confirmar la transacción del préstamo,
así nunca se anuncia un préstamo que no existe. Si RabbitMQ no está disponible en ese momento, el préstamo queda
creado y se registra el error en el log; la solución completa (patrón *transactional outbox*) queda como mejora.

## Alternativas consideradas
- **Kafka:** excelente para streaming y volumen alto; excesivo para este caso.
- **SQS/EventBridge:** requieren cuenta cloud; RabbitMQ corre local en Docker Compose.

## Consecuencias
- (+) Desacople de la API y fácil de levantar con Docker (consola en `:15672`).
- (−) Hay que manejar idempotencia del consumidor (posible re-entrega), resuelta con índices únicos.
- (−) Sin outbox, un fallo del broker justo después del commit pierde el evento (se acepta para el TPI).
