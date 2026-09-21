# C4 – Nivel 3: Componentes (contenedor API REST)

```mermaid
C4Component
  title Componentes - API REST

  Container_Ext(cliente, "Aplicación cliente", "HTTP / WebSocket")
  ContainerDb_Ext(db, "PostgreSQL", "Base de datos")
  ContainerQueue_Ext(broker, "RabbitMQ", "Broker")
  System_Ext(auth0, "Auth0", "JWKS")

  Container_Boundary(api, "API REST (Node.js + Express)") {
    Component(authmw, "Auth middleware", "express-oauth2-jwt-bearer", "Valida firma, issuer, audience, expiración y scopes requeridos por endpoint. Soporta x-api-key")
    Component(routers, "Routers / Controllers", "Express", "Titulos, Usuarios, Prestamos, Reservas. Validación de entrada y mapeo a HTTP")
    Component(prestamosvc, "PrestamoService", "JS", "Transacción multi-paso: valida usuario, título, duplicado y cupo; crea préstamo o reserva")
    Component(crudsvc, "Titulo/Usuario Service", "JS", "Reglas del CRUD")
    Component(repo, "Repositorios", "pg", "Acceso a datos y transacciones")
    Component(publisher, "Event Publisher", "amqplib", "Publica prestamo.creado")
    Component(wsgw, "WebSocket Gateway", "ws", "Notifica a la lista de espera cuando se libera cupo")
    Component(errmw, "Error handler + Logger", "pino", "Errores uniformes y logs JSON con correlationId")
    Component(metrics, "Metrics", "prom-client", "Latencia p95, throughput y error rate")
  }

  Rel(cliente, authmw, "Request + Bearer token")
  Rel(authmw, auth0, "Obtiene JWKS")
  Rel(authmw, routers, "Request autorizado")
  Rel(routers, prestamosvc, "Usa")
  Rel(routers, crudsvc, "Usa")
  Rel(prestamosvc, repo, "Usa")
  Rel(crudsvc, repo, "Usa")
  Rel(prestamosvc, publisher, "Emite evento")
  Rel(prestamosvc, wsgw, "Avisa cupo liberado")
  Rel(repo, db, "SQL")
  Rel(publisher, broker, "AMQP")
  Rel(cliente, wsgw, "WebSocket")
```
