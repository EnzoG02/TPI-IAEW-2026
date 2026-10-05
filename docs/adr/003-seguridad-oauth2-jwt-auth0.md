# ADR 003 – Seguridad: OAuth 2.0 client_credentials + JWT con Auth0

- **Estado:** Aceptado
- **Fecha:** 2026-09

## Contexto
La API debe validar identidad y permisos antes de ejecutar acciones sensibles. Los consumidores son aplicaciones (Machine to Machine), no usuarios interactivos.

## Decisión
- **Authorization Server:** Auth0 (API con `audience` propio y un cliente Machine to Machine).
- **Flujo:** OAuth 2.0 `client_credentials`; el cliente envía el access token como `Authorization: Bearer`.
- **Resource Server:** la API valida firma (JWKS), `issuer`, `audience`, expiración y **scopes** por endpoint. El handshake del WebSocket se valida igual (scope `read:prestamos`).
- **Scopes:** `read:titulos`, `write:titulos`, `read:usuarios`, `write:usuarios`, `read:prestamos`, `write:prestamos`.
- **API key:** un endpoint (`/status/api-key`) protegido con `x-api-key` únicamente como comparación; no reemplaza el esquema principal.
- Los secretos se cargan por variables de entorno (`.env`, no versionado); solo se sube `.env.example`.

## Alternativas consideradas
- **Keycloak autoalojado:** más control, más costo operativo.
- **Solo API key:** sin expiración ni scopes; insuficiente.

## Consecuencias
- (+) Permisos granulares por endpoint y tokens con expiración.
- (−) Dependencia externa de Auth0 (mitigada con caché de JWKS).
