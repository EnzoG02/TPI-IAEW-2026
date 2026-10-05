# C4 – Nivel 2: Contenedores

Los contenedores `api`, `worker`, `db` y `broker` existen en `docker-compose.yml` (placeholders en la Entrega 1).
Observabilidad (Prometheus + Grafana) se agrega en la Entrega 2.

![Contenedores](container-1.png)

```mermaid
C4Container
  title Contenedores - Biblioteca digital

  UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="1")

  System_Ext(cliente, "Aplicación cliente", "Sistema M2M")
  System_Ext(auth0, "Auth0", "Authorization Server")

  System_Boundary(sys, "Biblioteca digital (docker compose)") {
    Container(api, "API REST", "Node.js + Express", "CRUD, préstamos y devoluciones. Valida JWT/scopes. Gateway WebSocket")
    ContainerQueue(broker, "Message broker", "RabbitMQ", "Exchange biblioteca.eventos")
    Container(worker, "Worker de eventos", "Node.js", "Avisos, vencimientos y multas")
    ContainerDb(db, "Base de datos", "PostgreSQL 16", "usuarios, titulos, prestamos, reservas, avisos, multas")
    Container(obs, "Observabilidad (Entrega 2)", "Prometheus + Grafana", "p95, throughput, error rate y métricas de préstamos")
  }

  Rel(cliente, auth0, "Solicita token", "HTTPS")
  Rel(cliente, api, "Llama a la API / WS", "HTTPS + Bearer")
  Rel(api, auth0, "Obtiene JWKS", "HTTPS")
  Rel(api, db, "Lee y escribe", "SQL")
  Rel(api, broker, "Publica prestamo.creado", "AMQP")
  Rel(broker, worker, "Entrega evento", "AMQP")
  Rel(worker, db, "Registra avisos, multas y vencidos", "SQL")
  Rel(obs, api, "Scrapea /metrics", "HTTP")

  UpdateRelStyle(cliente, auth0, $offsetX="-40", $offsetY="-35")
  UpdateRelStyle(cliente, api, $offsetX="-120", $offsetY="-60")
  UpdateRelStyle(api, auth0, $offsetX="10", $offsetY="-60")
  UpdateRelStyle(api, broker, $offsetX="-60", $offsetY="35")
  UpdateRelStyle(broker, worker, $offsetX="-10", $offsetY="30")
```

Métricas de negocio previstas (además de p95, throughput y error rate): préstamos activos, préstamos vencidos,
reservas en espera y avisos enviados.
