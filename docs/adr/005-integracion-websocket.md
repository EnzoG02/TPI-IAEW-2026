# ADR 005 – Integración adicional: WebSocket para lista de espera

- **Estado:** Aceptado
- **Fecha:** 2026-09

## Contexto
Debe elegirse una integración entre Webhook, gRPC o WebSocket, visible en la demo. El dominio propone WebSocket para la lista de espera.

## Decisión
La API expone `GET /ws/lista-espera?tituloId={id}` (WebSocket, librería `ws`). Cuando una devolución libera cupo en un título con reservas `EN_ESPERA`, se envía un mensaje al primer usuario de la cola y su reserva pasa a `NOTIFICADA`. El endpoint exige token válido.

## Alternativas consideradas
- **Webhook firmado a mailing simulado:** más simple, pero menos visual en la demo.
- **gRPC a catálogo externo:** requiere un servicio adicional.

## Consecuencias
- (+) Notificación en tiempo real y demostrable.
- (−) Conexiones persistentes; no cubierto por OpenAPI (se documenta en la descripción del contrato y en este ADR).
