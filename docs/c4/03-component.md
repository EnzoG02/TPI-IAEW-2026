# C4 – Nivel 3: Componentes (contenedor API REST)

![Componentes](component-1.png)

```mermaid
C4Component
  title Componentes - API REST

  UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="1")

  System_Ext(cliente, "Aplicación cliente", "HTTP / WebSocket")
  System_Ext(auth0, "Auth0", "JWKS")

  Container_Boundary(api, "API REST (Node.js + Express)") {
    Component(wsgw, "WebSocket Gateway", "ws", "Suscripciones por usuarioId; avisa cupo")
    Component(authmw, "Auth middleware", "express-oauth2-jwt-bearer", "Valida JWT y scopes. x-api-key en /status/api-key")
    Component(routers, "Routers", "Express", "Titulos, Usuarios, Prestamos, Reservas")
    Component(prestamosvc, "PrestamoService", "JS", "Préstamo multi-paso y devolución")
    Component(crudsvc, "CRUD Service", "JS", "Reglas de Titulo y Usuario; consulta de Reservas")
    Component(errmw, "Error handler", "Express middleware", "Errores a {code, message, correlationId}")
    Component(publisher, "Event Publisher", "amqplib", "Publica prestamo.creado tras el commit")
    Component(repo, "Repositorios", "pg", "Acceso a datos y transacciones")
    Component(obs, "Logger y métricas", "pino + prom-client", "Logs JSON con correlationId; /metrics")
  }

  Boundary(infra, "Otros contenedores") {
    ContainerQueue_Ext(broker, "RabbitMQ", "Broker")
    ContainerDb_Ext(db, "PostgreSQL", "Base de datos")
  }

  Rel(cliente, wsgw, "Suscribe", "WebSocket")
  Rel(cliente, authmw, "Request", "HTTPS + Bearer")
  Rel(authmw, auth0, "Obtiene JWKS", "HTTPS")
  Rel(wsgw, authmw, "Handshake")
  Rel(authmw, routers, "Autorizada")
  Rel(routers, prestamosvc, "Usa")
  Rel(routers, crudsvc, "Usa")
  Rel(routers, errmw, "Errores")
  Rel(prestamosvc, wsgw, "Avisa cupo")
  Rel(prestamosvc, publisher, "Emite evento")
  Rel(prestamosvc, repo, "Usa")
  Rel(crudsvc, repo, "Usa")
  Rel(errmw, obs, "Registra")
  Rel(publisher, broker, "AMQP")
  Rel(repo, db, "SQL")

  UpdateRelStyle(cliente, wsgw, $offsetX="-110", $offsetY="-60")
  UpdateRelStyle(cliente, authmw, $offsetX="-20", $offsetY="-70")
  UpdateRelStyle(authmw, auth0, $offsetX="20", $offsetY="-70")
  UpdateRelStyle(wsgw, authmw, $offsetX="-45", $offsetY="-25")
  UpdateRelStyle(authmw, routers, $offsetX="-30", $offsetY="-25")
```

El worker es un proceso simple (consumidor + job de vencimientos) y no se detalla en este nivel; su
comportamiento está en el [ADR 004](../adr/004-broker-rabbitmq.md).
