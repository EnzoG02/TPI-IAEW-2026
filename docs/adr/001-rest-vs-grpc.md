# ADR 001 – Estilo de API: REST sobre HTTP (con OpenAPI 3.1)

- **Estado:** Aceptado
- **Fecha:** 2026-09

## Contexto
La API expone operaciones CRUD y un flujo de préstamo consumidos por clientes web/Postman. La consigna exige API REST con contrato OpenAPI 3.1.

## Decisión
Se usa **REST/JSON sobre HTTP** como estilo principal, con contrato en `api/openapi.yaml`. gRPC no se usa en la API principal.

## Alternativas consideradas
- **gRPC:** eficiente y fuertemente tipado, pero requiere generación de stubs, no es amigable desde navegador/Postman y no es lo pedido como API principal.
- **GraphQL:** flexible, pero agrega complejidad innecesaria para un dominio con recursos claros.

## Consecuencias
- (+) Herramientas simples (Postman, cURL, JMeter) y documentación estándar.
- (+) Códigos HTTP expresan los errores del dominio (403, 404, 409).
- (−) Menos eficiente en payload que gRPC; aceptable para la escala del TPI.
