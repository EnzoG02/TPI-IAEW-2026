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
Archivos SQL versionados en `db/migrations/` (`001_init.sql`) y `db/seed.sql`. En la Entrega 1 se aplican al iniciar el contenedor de Postgres por primera vez (`docker-entrypoint-initdb.d`). En la Entrega 2 se evaluará un runner (por ejemplo `node-pg-migrate`) para migraciones incrementales.
