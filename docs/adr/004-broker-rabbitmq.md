# ADR 004 – Asincronía: RabbitMQ (productor → broker → consumidor)

- **Estado:** Aceptado
- **Fecha:** 2026-09

## Contexto
Al crearse un préstamo deben gestionarse vencimientos, multas y avisos de devolución sin bloquear la respuesta HTTP.

## Decisión
Se usa **RabbitMQ**. La API (productor) publica `prestamo.creado` en un exchange; el worker (consumidor) lo procesa desde una cola durable, con ack manual y reintentos. Efecto visible: el aviso `PRESTAMO_CONFIRMADO` en `GET /avisos?prestamoId={id}`, en la tabla `avisos` y en los logs del worker (con el mismo correlation ID del request).

| Elemento | Valor |
|---|---|
| Exchange | `biblioteca.eventos` (topic, durable) |
| Routing key | `prestamo.creado` |
| Cola | `worker.prestamos` (durable, `prefetch(1)`, ack manual) |
| Reintentos | exchange `biblioteca.eventos.retry` → cola `worker.prestamos.retry`; el mensaje espera `RETRY_DELAY_MS` (TTL por mensaje, `expiration`) y vuelve por dead-letter a `biblioteca.eventos` |
| DLQ | exchange `biblioteca.eventos.dlx` → cola `worker.prestamos.dlq`, después de `MAX_RETRIES` (3) intentos o ante un error permanente |
| Payload | schema `EventoPrestamoCreado` en `api/openapi.yaml` (`eventId`, `occurredAt`, `correlationId`, `data`) |
| Headers | `x-correlation-id`, `traceparent` (la traza sigue de la API al worker) y `x-retry-count` |

La topología se adaptó del laboratorio de la clase 07. Diferencia: el TTL del reintento va en cada mensaje y no como
argumento de la cola, para poder cambiar `RETRY_DELAY_MS` sin que RabbitMQ rechace la redeclaración (error 406).

**Errores permanentes vs. transitorios:** un mensaje que no cumple el contrato o un préstamo inexistente va directo a
la DLQ; un error de base de datos se reintenta. Para la demo, `SIMULATE_TRANSIENT_FAILURES=N` hace fallar los primeros
N intentos de cada evento (con N ≤ 3 se recupera; con N > 3 termina en la DLQ).

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
creado y se registra el error en el log (`evento.publicacion_fallida`); la API se reconecta sola en la siguiente
publicación. La solución completa (patrón *transactional outbox*) queda como mejora. Se publica con *publisher
confirms*: el request no termina hasta que el broker confirma el mensaje.

## Alternativas consideradas
- **Kafka:** excelente para streaming y volumen alto; excesivo para este caso.
- **SQS/EventBridge:** requieren cuenta cloud; RabbitMQ corre local en Docker Compose.

## Consecuencias
- (+) Desacople de la API y fácil de levantar con Docker (consola en `:15672`).
- (−) Hay que manejar idempotencia del consumidor (posible re-entrega), resuelta con índices únicos.
- (−) Sin outbox, un fallo del broker justo después del commit pierde el evento (se acepta para el TPI).
