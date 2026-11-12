# ADR 008 – Estrategia de pruebas: Postman/Newman, JMeter y emisor JWT local

- **Estado:** Aceptado
- **Fecha:** 2026-11

## Contexto
La consigna pide una colección de Postman con variables y ambientes y una prueba de carga con JMeter o Postman, con
su reporte. Las pruebas tienen que poder repetirse sin pasos manuales y sin subir secretos al repositorio.

## Decisión
- **Pruebas funcionales y de contrato con Postman** (`tests/postman/`): una colección que recorre seguridad (401/403,
  `x-api-key`, correlation ID), el CRUD de las dos entidades, el préstamo multi-paso con todos sus errores, el flujo
  asincrónico (polling a `/avisos` hasta ver el efecto del worker) y la lista de espera.
  - Cada corrida crea sus propios datos con un `runId`, así que se puede repetir sin resetear la base.
  - El token se obtiene dentro de la colección con `client_credentials` y se reutiliza hasta que vence.
  - Dos environments: Auth0 (secretos vacíos, se completan localmente) y el emisor local.
- **Newman en Docker** (servicio `newman`, perfil `tests`) con reporte HTML `htmlextra`. Los secretos llegan desde
  `.env`. El reporte se genera con `skipSensitiveData` (sin headers ni cuerpos) para que no queden tokens; no se usa
  el reporter JSON porque los incluye.
- **Carga con JMeter en Docker** (servicio `jmeter`, perfil `carga`, ver `tests/carga/README.md`): plan versionado
  (`.jmx`), modo no-GUI y reporte HTML con percentiles. Pide **un** token por corrida.
- **Emisor JWT local** (`compose.local-auth.yaml`) para correr todo lo anterior sin Auth0, por ejemplo en CI.
- **Tests unitarios con `node:test`** (sin dependencias extra) para la lógica pura: la decisión ack / reintento / DLQ
  del consumidor y la validación de entrada contra el contrato.
- **CI en GitHub Actions** (`.github/workflows/ci.yml`): lint del contrato (Redocly), tests unitarios y un job de punta
  a punta que levanta el stack con el emisor local, corre Newman y una carga corta de JMeter con umbrales
  (p95 < 300 ms, errores < 1 %). Los reportes se publican como artefactos.

## Alternativas consideradas
- **Postman Performance runner** para la carga: más simple, pero se ejecuta desde la app y el reporte se exporta a
  mano; JMeter es reproducible con un comando.
- **Artillery** (usado en la clase 10): la consigna pide JMeter o Postman.
- **Tests de integración en código (supertest)**: duplicarían lo que ya cubre la colección; se dejan tests unitarios
  solo para la lógica pura.

## Consecuencias
- (+) Cualquiera reproduce las pruebas con `docker compose --profile tests run --rm newman` y
  `docker compose --profile carga run --rm jmeter`, sin instalar Node, Newman ni JMeter.
- (+) La misma colección sirve para la demo (Postman) y para la verificación automática (Newman).
- (−) Los casos que dependen del seed (usuario con préstamos vencidos) suponen que ese préstamo no se devolvió.
