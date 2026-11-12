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

## Implementación (Entrega 2)
- `express-oauth2-jwt-bearer` (la misma librería del laboratorio de la clase 07): `auth()` descubre el JWKS del
  tenant y valida firma RS256, `iss`, `aud` y `exp`; `requiredScopes()` exige el scope de cada ruta
  (`services/api/src/middleware/auth.js`). Los errores salen con el formato del ADR 006:
  401 `NO_AUTENTICADO` (sin token, mal formado, firma inválida o vencido) y 403 `SIN_PERMISO` (indica el scope que falta).
- Dos clientes M2M en Auth0 (`docs/auth0.md`): `biblioteca-cliente` con todos los scopes y `biblioteca-lector` con
  solo `read:*`, para demostrar el 403.
- El handshake del WebSocket se valida con `jose` contra el mismo issuer y audience (ver ADR 005).
- `x-api-key` se compara en tiempo constante (`crypto.timingSafeEqual` sobre hashes SHA-256).
- **Emisor local solo para pruebas automatizadas** (`tools/issuer-local`, `compose.local-auth.yaml`): imita el
  endpoint `/oauth/token`, el discovery y el JWKS de Auth0 con una clave RS256 generada al arrancar. Permite correr
  Newman y la carga en CI sin secretos reales. La API no cambia: solo apunta `AUTH0_ISSUER_BASE_URL` a ese emisor.
  La demo y la entrega usan Auth0.

## Alternativas consideradas
- **Keycloak autoalojado:** más control, más costo operativo.
- **Solo API key:** sin expiración ni scopes; insuficiente.

## Consecuencias
- (+) Permisos granulares por endpoint y tokens con expiración.
- (−) Dependencia externa de Auth0 (mitigada con caché de JWKS).
