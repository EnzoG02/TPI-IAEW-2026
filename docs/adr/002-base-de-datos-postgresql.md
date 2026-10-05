# ADR 002 – Base de datos: PostgreSQL (SQL)

- **Estado:** Aceptado
- **Fecha:** 2026-09

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
- **Entrega 2:** como el mecanismo anterior no aplica migraciones nuevas sobre una base existente, se incorpora
  `node-pg-migrate` (mismo stack que la API). Un paso `npm run migrate` al iniciar la API aplica en orden los
  archivos de `db/migrations/` que falten y registra cada versión en la tabla `pgmigrations`. Toda modificación
  del esquema es un archivo nuevo (`002_...`); nunca se edita una migración ya aplicada.
- El seed queda separado de las migraciones (solo datos de demo) y se puede recargar sin tocar el esquema.

## Borrado de registros
Las FK no tienen `ON DELETE CASCADE`: borrar un usuario o un título con historial (préstamos, reservas, avisos,
multas) perdería trazabilidad. La API devuelve 409 (`USUARIO_CON_HISTORIAL` / `TITULO_CON_HISTORIAL`); un usuario
con historial se da de baja bloqueándolo.
