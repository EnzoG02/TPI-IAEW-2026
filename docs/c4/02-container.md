# C4 – Nivel 2: Contenedores

Cada contenedor corresponde a un servicio de `docker-compose.yml`. `migrate` es un contenedor de una sola ejecución:
aplica migraciones y seed y termina antes de que arranquen la API y el worker (ADR 002). La observabilidad usa
`grafana/otel-lgtm` (ADR 007).

![Contenedores](container-1.png)

```mermaid
C4Container
  title Contenedores - Biblioteca digital

  UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="1")

  Person(operador, "Operador", "Observa el dashboard")
  System_Ext(cliente, "Aplicación cliente", "Sistema M2M (Postman, JMeter, cliente WS)")
  System_Ext(auth0, "Auth0", "Authorization Server")

  System_Boundary(sys, "Biblioteca digital (docker compose)") {
    Container(obs, "Observabilidad", "grafana/otel-lgtm", "Grafana, Prometheus, Loki y Tempo. Recibe OTLP de la API y del worker")
    Container(api, "API REST", "Node.js 22 + Express 5", "CRUD, préstamo multi-paso y devolución. Valida JWT/scopes. Gateway WebSocket")
    ContainerQueue(broker, "Message broker", "RabbitMQ 3.13", "biblioteca.eventos, retry y DLQ")
    Container(migrate, "Migraciones", "Node.js (one-shot)", "Aplica db/migrations y el seed")
    ContainerDb(db, "Base de datos", "PostgreSQL 16", "usuarios, titulos, prestamos, reservas, avisos, multas")
    Container(worker, "Worker de eventos", "Node.js 22", "Avisos de préstamo, vencimientos y multas")
  }

  Rel(operador, obs, "Dashboard", "HTTP :3001")
  Rel(cliente, api, "REST y WebSocket", "HTTP + Bearer")
  Rel(cliente, auth0, "Solicita token", "client_credentials")
  Rel(api, auth0, "Obtiene JWKS", "HTTPS")
  Rel(api, obs, "Telemetría", "OTLP")
  Rel(api, broker, "Publica evento", "AMQP")
  Rel(api, db, "Lee y escribe", "SQL")
  Rel(broker, worker, "Entrega evento", "AMQP")
  Rel(worker, db, "Avisos y multas", "SQL")
  Rel(migrate, db, "Migra y seed", "SQL")

  UpdateRelStyle(cliente, auth0, $offsetX="-55", $offsetY="-40")
  UpdateRelStyle(operador, obs, $offsetX="-10", $offsetY="-50")
  UpdateRelStyle(api, obs, $offsetX="-45", $offsetY="-30")
  UpdateRelStyle(api, broker, $offsetX="-45", $offsetY="30")
  UpdateRelStyle(worker, db, $offsetX="-45", $offsetY="-30")
  UpdateRelStyle(migrate, db, $offsetX="-45", $offsetY="-30")
```

Métricas del dashboard: p95/p50, throughput y error rate por ruta; préstamos activos y vencidos, reservas en espera
y avisos por tipo; intentos del worker por resultado. Detalle en el [ADR 007](../adr/007-observabilidad-opentelemetry.md).
