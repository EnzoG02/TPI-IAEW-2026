# Biblioteca digital

> TPI – Entrega 1: Diseño y esqueleto · Dominio 5

## Proyecto

- **Dominio elegido:** Biblioteca digital (Dominio 5)
- **Materia / Comisión:** Integración de Aplicaciones en Entorno Web / 5k4
- **Integrantes:**

| Nombre y apellido | Legajo |
| :--- | :--- |
| Ostertag Garcia Bautista | 97621 |
| Cagnolo Ezequiel | 83630 | 
| Gardel Enzo Uriel | 98019 |
| Valverde Segura Fabrizio | 96061 |

## Problema y alcance

Gestionar títulos digitales, préstamos, devoluciones y listas de espera. Un usuario habilitado puede pedir prestado un e-book si hay cupo disponible; si no lo hay, puede quedar en lista de espera y ser notificado en tiempo real cuando se libere cupo.

**Alcance funcional**

- CRUD de dos entidades: **Títulos** y **Usuarios**.
- Transacción multi-paso: **prestar un e-book** (valida usuario habilitado y sin préstamos vencidos, título existente, préstamo duplicado, cupo y lista de espera; calcula el vencimiento y publica el evento `prestamo.creado`). Detalle paso a paso en `POST /prestamos` del [contrato](api/openapi.yaml).
- Errores del dominio: cupo agotado (409), préstamo duplicado (409), usuario bloqueado (403), título inexistente (404). Además: usuario con préstamos vencidos (403) y reserva duplicada (409).
- Asincronía: evento `prestamo.creado` (RabbitMQ) para vencimientos, multas y avisos de devolución.
- Integración adicional: WebSocket para lista de espera (al devolverse un e-book, se avisa al primero de la cola).
- Observabilidad (Entrega 2): logs JSON con correlation ID, p95, throughput, error rate y métricas de negocio (préstamos activos y vencidos, reservas en espera, avisos enviados).

## Arquitectura en un vistazo

- Diagramas C4: [Contexto](docs/c4/01-context.md) · [Contenedores](docs/c4/02-container.md) · [Componentes](docs/c4/03-component.md)
- Decisiones técnicas (ADRs): [docs/adr/](docs/adr/README.md) — REST vs gRPC, PostgreSQL, seguridad, RabbitMQ, WebSocket y [estilo de API](docs/adr/006-estilo-api.md)
- Contrato de la API: [api/openapi.yaml](api/openapi.yaml) (OpenAPI 3.1)

Servicios (Docker Compose): `api` (Node.js), `worker` (Node.js), `db` (PostgreSQL 16), `broker` (RabbitMQ). Prometheus + Grafana se suman en la Entrega 2.

## Requisitos previos

- Docker Desktop (o Docker Engine) con Docker Compose v2
- Git
- (Opcional) Node.js 20+ para desarrollo fuera de Docker

## Variables de entorno

Copiar `.env.example` a `.env` y ajustar valores. **No subir `.env` al repositorio.**

| Variable | Descripción |
|---|---|
| `API_PORT` | Puerto expuesto por la API (3000) |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Credenciales de la base |
| `DATABASE_URL` | Cadena de conexión que usa la API |
| `RABBITMQ_DEFAULT_USER` / `RABBITMQ_DEFAULT_PASS` / `RABBITMQ_URL` | Credenciales y URL del broker |
| `AUTH0_DOMAIN` / `AUTH0_ISSUER` / `AUTH0_AUDIENCE` | Configuración de Auth0 (Entrega 2) |
| `API_KEY` | Clave del endpoint de comparación `x-api-key` (Entrega 2) |

## Levantar localmente

```bash
cp .env.example .env
docker compose up --build
```

Verificar:

```bash
curl http://localhost:3000/health          # {"status":"ok","service":"api"}
docker compose logs worker                 # "hello from biblioteca-worker"
```

RabbitMQ Management: http://localhost:15672 (credenciales del `.env`).

Detener y borrar datos: `docker compose down -v`

## Cargar datos iniciales

El esquema (`db/migrations/001_init.sql`) y los datos de demo (`db/seed.sql`) se aplican automáticamente la **primera vez** que arranca el contenedor `db` (volumen vacío). Para reiniciarlos: `docker compose down -v && docker compose up --build`.

Datos de demo pensados para reproducir cada caso del préstamo:

| Caso | Request `POST /prestamos` | Resultado esperado |
|---|---|---|
| Préstamo exitoso | `{"usuarioId": 2, "tituloId": 1}` | 201 |
| Usuario bloqueado (Carla) | `{"usuarioId": 3, "tituloId": 1}` | 403 `USUARIO_BLOQUEADO` |
| Préstamos vencidos (Diego) | `{"usuarioId": 4, "tituloId": 1}` | 403 `PRESTAMOS_VENCIDOS` |
| Título inexistente | `{"usuarioId": 2, "tituloId": 99}` | 404 `TITULO_NO_ENCONTRADO` |
| Préstamo duplicado (Ana ya tiene *El Aleph*) | `{"usuarioId": 1, "tituloId": 3}` | 409 `PRESTAMO_DUPLICADO` |
| Cupo agotado (*El Aleph*) | `{"usuarioId": 2, "tituloId": 3}` | 409 `CUPO_AGOTADO` |

Lista de espera: Bruno ya está en la cola de *El Aleph*. Si Ana lo devuelve (`POST /prestamos/1/devolucion`), Bruno recibe el aviso por WebSocket y es el único que puede tomar ese cupo.

Verificar:

```bash
docker compose exec db psql -U biblioteca -d biblioteca -c "SELECT id, titulo, cupo_disponible FROM titulos;"
```

## Estado de la Entrega 1

| Ítem | Estado |
|---|---|
| Diagramas C4 (Context, Container, Component) | ✅ `docs/c4/` |
| ADRs (REST/gRPC, BD, seguridad, broker, integración, estilo de API) | ✅ `docs/adr/` (001–006) |
| Contrato OpenAPI 3.1 con ejemplos | ✅ `api/openapi.yaml` |
| Modelo de datos + migración + seed | ✅ `db/` |
| `docker-compose.yml` con API, DB y broker (placeholders) | ✅ |
| Tag de release y hash de commit | ✅ ver abajo |

## Modelo de datos

```
usuarios(id, nombre, email*, estado)
titulos(id, titulo, autor, isbn*, cupo_total, cupo_disponible)
prestamos(id, usuario_id→usuarios, titulo_id→titulos, fecha_prestamo, fecha_vencimiento, fecha_devolucion, estado)
reservas(id, usuario_id→usuarios, titulo_id→titulos, estado, created_at, notificada_at)
avisos(id, usuario_id→usuarios, prestamo_id→prestamos, reserva_id→reservas, tipo, canal, created_at)
multas(id, prestamo_id*→prestamos, usuario_id→usuarios, monto, estado, created_at)
```

Restricciones clave: `cupo_disponible` entre 0 y `cupo_total`; índice único parcial que impide dos préstamos sin devolver (`ACTIVO`/`VENCIDO`) del mismo título por usuario; una sola reserva vigente por usuario y título; la posición en lista de espera se calcula por antigüedad. `avisos` y `multas` los escribe el worker, con índices únicos que lo hacen idempotente ante re-entregas del broker.

Estrategia de migraciones (hoy scripts de inicialización de Postgres; en la Entrega 2 `node-pg-migrate`): ver [ADR 002](docs/adr/002-base-de-datos-postgresql.md#migraciones-y-seed).

---

## Pendiente para la Entrega 2

Las siguientes secciones del checklist del README se completan con la implementación:

- Configuración de Auth0 (API, audience, issuer, scopes, cliente Machine to Machine y permisos).
- Cómo obtener un token con `client_credentials` y probar endpoints protegidos con Bearer token.
- Cómo probar el ejemplo con `x-api-key`.
- Cómo ejecutar pruebas.
- Cómo disparar el flujo asincrónico y dónde ver el efecto.
- Cómo probar la integración elegida (WebSocket).
- Cómo observar el sistema: logs JSON, correlation ID, dashboard y métricas.
- Endpoints principales y ejemplos de uso (Postman collection).
- Limitaciones conocidas y mejoras futuras.

## Evidencia de entrega

- **Tag/release:** `v1.0.0` (`git checkout v1.0.0`)
- **Hash del commit entregado:** `2d5fccc7fa3b9d7e7310da7a5ede019653b85ef6` (el tag `v1.0.0` apunta al commit siguiente, que solo agrega este hash al README)
- **Archivo `.zip`:** subido a UV/Moodle.
