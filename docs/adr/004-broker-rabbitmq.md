# ADR 004 – Asincronía: RabbitMQ (productor → broker → consumidor)

- **Estado:** Aceptado
- **Fecha:** 2026-09

## Contexto
Al crearse un préstamo deben gestionarse vencimientos, multas y avisos de devolución sin bloquear la respuesta HTTP.

## Decisión
Se usa **RabbitMQ**. La API (productor) publica `prestamo.creado` en un exchange; el worker (consumidor) lo procesa desde una cola durable, con ack manual y reintentos. Efecto visible: registros de vencimiento/aviso y logs del worker.

## Alternativas consideradas
- **Kafka:** excelente para streaming y volumen alto; excesivo para este caso.
- **SQS/EventBridge:** requieren cuenta cloud; RabbitMQ corre local en Docker Compose.

## Consecuencias
- (+) Desacople de la API y fácil de levantar con Docker (consola en `:15672`).
- (−) Hay que manejar idempotencia del consumidor (posible re-entrega).
