# Resultado de la prueba de carga (JMeter)

Corrida entregada. Escenario y forma de ejecutarla: [tests/carga/README.md](../../../tests/carga/README.md).
Reporte completo de JMeter: [reporte/index.html](reporte/index.html) · datos crudos: [resultados.jtl](resultados.jtl).

## Condiciones

| Dato | Valor |
|---|---|
| Fecha | 2026-11-12 |
| Commit | `4c8cef7` (rama `entrega-2`) |
| Autorización | Auth0 real (tenant `dev-wgynhn5mtrfjkjkz`), un token `client_credentials` para toda la corrida |
| Carga | 20 usuarios virtuales, rampa de 20 s, 2 minutos, pausa aleatoria de 100–400 ms entre requests |
| Equipo | Notebook AMD Ryzen 7 7840HS, 15 GB de RAM, Windows 11; Docker Desktop con 16 CPU y ~7.4 GB |
| Stack | Todo en Docker Compose en el mismo equipo (API, worker, PostgreSQL, RabbitMQ, Grafana LGTM y JMeter) |

## Resultados

| Request | Muestras | Errores | Promedio | p90 | p95 | p99 | Máximo |
|---|---:|---:|---:|---:|---:|---:|---:|
| `GET /titulos` | 1242 | 0 % | 2.3 ms | 3 ms | 4 ms | 5 ms | 20 ms |
| `GET /titulos/{id}` | 1240 | 0 % | 2.2 ms | 3 ms | 4 ms | 5 ms | 7 ms |
| `POST /usuarios` | 1235 | 0 % | 4.7 ms | 6 ms | 7 ms | 9 ms | 18 ms |
| `POST /prestamos` (multi-paso) | 1234 | 0 % | 14.9 ms | 18 ms | 21 ms | 30 ms | 54 ms |
| `GET /prestamos` | 1230 | 0 % | 2.4 ms | 3 ms | 4 ms | 5 ms | 23 ms |
| `POST /prestamos/{id}/devolucion` | 1226 | 0 % | 7.0 ms | 9 ms | 11 ms | 18 ms | 29 ms |
| `GET /avisos` | 1223 | 0 % | 2.4 ms | 3 ms | 4 ms | 5 ms | 53 ms |
| **Total** | **8632** | **0 %** | **5.3 ms** | **13 ms** | **15 ms** | **20 ms** | 1497 ms\* |

\* El máximo total corresponde a la única request del setUp que pide el token a Auth0 (servicio externo, por
internet); las requests a la API tienen un máximo de 54 ms.

**Throughput:** 70.7 requests/s en total (≈10.4 préstamos multi-paso por segundo, cada uno con su evento en RabbitMQ).

## Criterios de aceptación

| Métrica | Umbral | Resultado |
|---|---|---|
| Latencia p95 | < 300 ms | **15 ms** ✅ |
| Tasa de errores | < 1 % | **0 %** ✅ |
| Errores de concurrencia en el flujo de escritura | 0 | **0** ✅ |

## Observaciones

- La operación más costosa es el préstamo multi-paso (p95 21 ms): es una transacción con bloqueo del título
  (`SELECT … FOR UPDATE`), varias consultas de validación y la publicación confirmada del evento en RabbitMQ.
  Todos los usuarios virtuales prestan **el mismo título**, así que la prueba también ejercita la contención del
  bloqueo; no hubo errores ni cupos negativos.
- El worker procesó todos los eventos sin reintentos ni mensajes en la DLQ
  (ver [capturas/grafana-dashboard-negocio-worker-logs.jpg](../capturas/grafana-dashboard-negocio-worker-logs.jpg)).
- Durante la corrida el dashboard de Grafana mostró ~78 req/s, p95 de ~20 ms y 0 % de errores
  ([capturas/grafana-dashboard-http.jpg](../capturas/grafana-dashboard-http.jpg)); la pequeña diferencia con JMeter es
  porque Grafana calcula el p95 con los buckets del histograma y en ventanas de 1 minuto.
- Limitación de la medición: JMeter corre en el mismo equipo que el sistema, así que compite por CPU; los valores
  absolutos sirven para comparar corridas, no como capacidad de un entorno productivo.
