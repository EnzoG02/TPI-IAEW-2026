# C4 – Nivel 1: Contexto

Muestra el sistema como una caja negra, junto con quién lo usa y con qué sistemas externos se relaciona.

```mermaid
C4Context
  title Contexto - Biblioteca digital

  Person(cliente, "Aplicación cliente", "Front-end, Postman o servicio que consume la API (Machine to Machine)")
  Person(operador, "Operador / Bibliotecario", "Consulta dashboards y gestiona títulos y usuarios")

  System(biblioteca, "Biblioteca digital", "Gestiona títulos, usuarios, préstamos, devoluciones y listas de espera")

  System_Ext(auth0, "Auth0", "Authorization Server: emite tokens JWT (client_credentials) con scopes")

  Rel(cliente, auth0, "Obtiene access token", "HTTPS / OAuth 2.0")
  Rel(cliente, biblioteca, "Usa la API REST con Bearer token", "HTTPS / JSON")
  Rel(cliente, biblioteca, "Recibe avisos de lista de espera", "WebSocket")
  Rel(operador, biblioteca, "Observa métricas y logs", "Dashboard")
  Rel(biblioteca, auth0, "Descarga claves públicas (JWKS) para validar firma", "HTTPS")
```
