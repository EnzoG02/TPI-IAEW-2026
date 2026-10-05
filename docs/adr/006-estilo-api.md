# ADR 006 – Estilo y convenciones de la API

- **Estado:** Aceptado
- **Fecha:** 2026-10

## Contexto
El ADR 001 elige REST como estilo. Falta fijar las convenciones del contrato para que todos los endpoints se
comporten igual y el contrato (`api/openapi.yaml`) sea predecible para quien lo consuma.

## Decisión

**Contrato primero.** `api/openapi.yaml` se escribe antes que el código y es la referencia; la implementación
de la Entrega 2 valida las requests contra sus schemas.

**Recursos y nombres**
- Sustantivos en plural y en español: `/titulos`, `/usuarios`, `/prestamos`, `/reservas`.
- Paths en minúsculas con guiones (`/lista-espera`), JSON en `camelCase` (`cupoDisponible`) y base de datos en
  `snake_case` (la conversión se hace en los repositorios).
- IDs enteros; fechas en ISO 8601 con zona horaria (UTC).

**Métodos**
- `GET` lectura, `POST` alta, `PUT` reemplazo completo, `DELETE` baja. No se usa `PATCH`.
- Las operaciones de negocio con efectos laterales se modelan como subrecurso con `POST`
  (`POST /prestamos/{id}/devolucion`) y no como un `PUT` del campo `estado`: la devolución libera cupo, avisa a la
  lista de espera y no debe poder "deshacerse" editando el recurso.

**Códigos HTTP**

| Código | Uso |
|---|---|
| 200 | Lectura, actualización o acción correcta |
| 201 | Recurso creado; incluye header `Location` |
| 202 | Préstamo pedido sin cupo: queda como reserva en la lista de espera, pero el préstamo no se concretó |
| 204 | Baja correcta (sin cuerpo) |
| 400 | Validación de entrada (`VALIDACION`) |
| 401 | Credencial ausente, inválida o expirada |
| 403 | Falta el scope, **o** una regla de negocio sobre el usuario (bloqueado, con préstamos vencidos) |
| 404 | El recurso del path o uno referenciado en el body no existe |
| 409 | Conflicto con el estado actual (cupo agotado, duplicados, historial que impide borrar) |
| 500 | Error inesperado (`INTERNO`), sin detalles internos en la respuesta |

**Errores.** Siempre el mismo cuerpo: `{ "code", "message", "correlationId" }`. `code` es estable, en
mayúsculas y está enumerado en el schema `Error`; `message` es para personas y puede cambiar.

**Listados.** Paginación con `page` (desde 1) y `pageSize` (default 20, máximo 100); respuesta
`{ data, page, pageSize, total }`. Los filtros van como query params (`?estado=ACTIVO&usuarioId=2`).

**Correlation ID.** Header `X-Correlation-Id`: si el cliente lo envía se respeta, si no la API lo genera. Se
devuelve en la respuesta, en los errores, en los logs y viaja dentro de los eventos de RabbitMQ.

**Seguridad.** Un par de scopes por recurso (`read:x` / `write:x`); cada operación declara el suyo en el contrato.

**Versionado.** Sin prefijo `/v1` mientras exista una sola versión; la versión del contrato está en
`info.version`. Un cambio incompatible implicaría publicar `/v2` manteniendo la versión anterior.

## Alternativas consideradas
- **Nombres en inglés:** más habitual, pero el dominio y el equipo trabajan en español; mezclar idiomas confunde.
- **`PATCH /prestamos/{id}` con `estado: DEVUELTO`:** más "CRUD", pero esconde una operación de negocio con efectos.
- **Formato de error RFC 9457 (`application/problem+json`):** estándar, pero más verboso; se toma la idea
  (código estable + mensaje) con un formato propio más simple.

## Consecuencias
- (+) Endpoints consistentes; los clientes manejan errores por `code` sin parsear mensajes.
- (+) El correlation ID permite seguir una operación desde la request hasta el worker.
- (−) El 403 tiene dos significados (scope y regla de negocio); se distinguen por `code`.
