# ADR 005 – Integración adicional: WebSocket para lista de espera

- **Estado:** Aceptado
- **Fecha:** 2026-09

## Contexto
Debe elegirse una integración entre Webhook, gRPC o WebSocket, visible en la demo. El dominio propone WebSocket para la lista de espera.

## Decisión
La API expone `GET /ws/lista-espera?usuarioId={id}` (WebSocket, librería `ws`), atendido por el mismo proceso HTTP.

- **Autenticación:** el handshake exige `Authorization: Bearer <token>` con scope `read:prestamos`, validado igual
  que en los endpoints REST. Los clientes son aplicaciones M2M (Postman, Node), que sí pueden enviar headers en el
  handshake. Si se necesitara un cliente de navegador, el token iría en el header `Sec-WebSocket-Protocol`, nunca en
  la URL (quedaría en los logs).
- **A quién se avisa:** el token M2M identifica a la aplicación, no al lector; por eso la conexión indica `usuarioId`.
  La API guarda en memoria qué sockets están suscriptos a cada usuario.
- **Flujo:** cuando una devolución libera cupo en un título con reservas `EN_ESPERA`, la primera de la cola pasa a
  `NOTIFICADA` (el cupo queda guardado para ese usuario), se envía un mensaje `MensajeListaEspera`
  (ver `api/openapi.yaml`) a sus sockets y se registra el aviso `CUPO_DISPONIBLE` (canal `WEBSOCKET`).
- **Usuario desconectado:** la reserva queda igual en `NOTIFICADA`; el usuario la ve con `GET /reservas` y puede
  tomar el préstamo.

## Implementación (Entrega 2)
- `services/api/src/ws/listaEspera.js`: `WebSocketServer` en modo `noServer` sobre el mismo servidor HTTP de la API
  (puerto 3000). El evento `upgrade` valida ruta, `usuarioId` y token **antes** de aceptar la conexión; si algo falla
  responde el handshake con 404, 400, 401 o 403 y cierra el socket.
- El token se verifica con `jose` (`createRemoteJWKSet` + `jwtVerify`) usando el issuer y el `jwks_uri` del discovery
  de Auth0, y se exige el scope `read:prestamos`.
- Mensajes JSON: `suscripcion.ok` al conectarse y `cupo.disponible` (schema `MensajeListaEspera`) al liberarse cupo,
  con el `correlationId` del request de devolución que lo originó.
- Heartbeat con ping/pong cada 30 s para cerrar conexiones muertas; `maxPayload` de 4 KB.
- Cliente de demo: `docker compose run --rm tools node scripts/ws-client.js <usuarioId>` (pide el token con
  `client_credentials` y muestra cada mensaje recibido).

## Alternativas consideradas
- **Webhook firmado a mailing simulado:** más simple, pero menos visual en la demo.
- **gRPC a catálogo externo:** requiere un servicio adicional.

## Consecuencias
- (+) Notificación en tiempo real y demostrable.
- (−) Conexiones persistentes; no cubierto por OpenAPI (se documenta en la descripción del contrato, el schema `MensajeListaEspera` y este ADR).
- (−) Las suscripciones viven en memoria: con más de una réplica de la API haría falta repartir los avisos (por ejemplo, vía RabbitMQ). Fuera del alcance del TPI.
