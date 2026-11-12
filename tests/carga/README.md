# Prueba de carga (JMeter)

Plan: [`biblioteca.jmx`](biblioteca.jmx) (JMeter 5.6.3). Se ejecuta en Docker, no hace falta instalar JMeter.

## Escenario

| Fase | Qué hace |
|---|---|
| setUp (1 vez) | Pide **un** token con `client_credentials` (respeta la cuota de Auth0) y crea un título con cupo alto para la prueba. |
| Carga | Cada usuario virtual repite: `GET /titulos`, `GET /titulos/{id}`, `POST /usuarios`, `POST /prestamos` (transacción multi-paso que publica `prestamo.creado`), `GET /prestamos`, `POST /prestamos/{id}/devolucion`, `GET /avisos`, con una pausa aleatoria de 100–400 ms entre requests. |

Parámetros por defecto (se cambian con variables de entorno al correrlo):

| Variable | Default | Significado |
|---|---|---|
| `CARGA_THREADS` | 20 | usuarios virtuales concurrentes |
| `CARGA_RAMPUP` | 20 | segundos para llegar a todos los usuarios |
| `CARGA_DURATION` | 120 | duración total en segundos |

Cada request lleva `X-Correlation-Id: jmeter-<hilo>-<n>`, así se pueden buscar en los logs (Loki) y en el dashboard.

## Criterios de aceptación

| Métrica | Umbral |
|---|---|
| Latencia p95 (todas las requests) | < 300 ms |
| Tasa de errores | < 1 % |
| Préstamos sin errores de concurrencia (cupo, duplicados) | 0 errores 409/500 en el flujo de escritura |

## Cómo ejecutarla

Con el stack levantado (`docker compose up -d --build --wait`) y las credenciales del cliente M2M en `.env`:

```bash
docker compose --profile carga run --rm jmeter
```

Prueba corta (por ejemplo, para verificar que todo anda):

```bash
CARGA_DURATION=30 CARGA_THREADS=10 docker compose --profile carga run --rm jmeter
```

Mientras corre, abrir el dashboard de Grafana (<http://localhost:3001>, *Biblioteca digital · API, negocio y worker*)
para ver p95, throughput y error rate en vivo.

## Resultados

- Reporte HTML de JMeter: `docs/evidencias/carga/reporte/index.html` (percentiles 90/95/99, throughput, errores,
  tiempos por request y en el tiempo).
- Datos crudos: `docs/evidencias/carga/resultados.jtl`.
- Resumen y conclusiones de la corrida entregada: [`docs/evidencias/carga/README.md`](../../docs/evidencias/carga/README.md).

El log de JMeter queda dentro del contenedor (`/tmp/jmeter.log`) porque registra las propiedades `-J`, entre ellas el
client secret. Los reportes no guardan headers ni cuerpos, así que no contienen tokens.
