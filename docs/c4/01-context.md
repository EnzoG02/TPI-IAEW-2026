# C4 – Nivel 1: Contexto

Muestra el sistema como una caja negra, junto con quién lo usa y con qué sistemas externos se relaciona.
Los consumidores son aplicaciones (Machine to Machine), por eso la aplicación cliente es un sistema externo y no una persona.

![Contexto](context-1.png)

```mermaid
C4Context
  title Contexto - Biblioteca digital

  UpdateLayoutConfig($c4ShapeInRow="2", $c4BoundaryInRow="1")

  Person(operador, "Operador", "Gestiona títulos y usuarios; observa métricas")
  System_Ext(cliente, "Aplicación cliente", "Sistema M2M que gestiona préstamos en nombre de los lectores")

  System(biblioteca, "Biblioteca digital", "Títulos, préstamos, devoluciones y lista de espera")

  System_Ext(auth0, "Auth0", "Authorization Server")

  Rel(cliente, auth0, "Obtiene token", "OAuth 2.0 client_credentials")
  Rel(cliente, biblioteca, "Usa la API y recibe avisos", "HTTPS + WebSocket, Bearer")
  Rel(operador, biblioteca, "Observa métricas", "Dashboard")
  Rel(biblioteca, auth0, "Valida firma (JWKS)", "HTTPS")

  UpdateRelStyle(cliente, biblioteca, $offsetX="-20", $offsetY="30")
  UpdateRelStyle(biblioteca, auth0, $offsetX="-45", $offsetY="50")
```
