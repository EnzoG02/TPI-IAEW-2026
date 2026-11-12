# ADR 002 – Base de datos: PostgreSQL (SQL)

- **Estado:** Aceptado (actualizado en la Entrega 2: migraciones)
- **Fecha:** 2026-09 / 2026-11

## Contexto
El dominio (usuarios, títulos, préstamos, reservas) es altamente relacional. El préstamo requiere una transacción multi-paso que descuenta cupo y crea el registro de forma atómica, evitando sobre-préstamo bajo concurrencia.

## Decisión
Se usa **PostgreSQL 16**. El control de cupo se hace con `SELECT ... FOR UPDATE` sobre el título dentro de la transacción, más restricciones de integridad (`CHECK` de cupo, índice único parcial para préstamo activo duplicado).

## Alternativas consideradas
- **MongoDB (NoSQL):** esquema flexible, pero las transacciones multi-documento y las restricciones únicas parciales son más incómodas para este caso.
- **MySQL:** viable, pero sin índices únicos parciales nativos.

## Consecuencias
- (+) Integridad garantizada por la base (duplicados y cupo negativo imposibles).
- (+) Migraciones SQL versionadas y seed reproducible.
- (−) Escalado horizontal más costoso; fuera del alcance del TPI.

## Migraciones y seed
- **Entrega 1:** archivos SQL versionados en `db/migrations/` (`001_init.sql`) y `db/seed.sql`, montados en
  `/docker-entrypoint-initdb.d` de Postgres. Se ejecutan en orden **solo cuando el volumen está vacío**;
  para reaplicarlos: `docker compose down -v`.
- **Entrega 2 (implementado):** el mecanismo anterior no aplica migraciones nuevas sobre una base existente, así que
  se reemplazó por un **runner propio** de unas 60 líneas (`services/api/scripts/db-tools.js`), ejecutado por el
  servicio `migrate` de Docker Compose antes de que arranquen la API y el worker
  (`depends_on: condition: service_completed_successfully`):
  - aplica en orden alfabético los archivos de `db/migrations/` que falten, cada uno en su propia transacción;
  - registra cada versión aplicada en la tabla `schema_migrations`;
  - toma un *advisory lock* de PostgreSQL para que dos ejecuciones simultáneas no se pisen;
  - toda modificación del esquema es un archivo nuevo (`002_...`); nunca se edita una migración ya aplicada.
- **Seed idempotente:** `db/seed.sql` se carga solo si la tabla `usuarios` está vacía, así que `migrate` puede
  correr en cada arranque sin duplicar datos.
- **Reset para pruebas y demo:** `docker compose run --rm tools node scripts/reset.js` borra el esquema, reaplica
  las migraciones y el seed (deja la base como recién levantada).
- **Por qué un runner propio y no `node-pg-migrate`** (lo previsto en la E1): las migraciones son SQL puro y el
  runner hace exactamente lo necesario (versionado, transacción, lock), sin agregar una dependencia ni un formato de
  archivo nuevo. Si el proyecto creciera (migraciones *down*, varios entornos), se migraría a Flyway o node-pg-migrate.

## Borrado de registros
Las FK no tienen `ON DELETE CASCADE`: borrar un usuario o un título con historial (préstamos, reservas, avisos,
multas) perdería trazabilidad. La API devuelve 409 (`USUARIO_CON_HISTORIAL` / `TITULO_CON_HISTORIAL`); un usuario
con historial se da de baja bloqueándolo.
