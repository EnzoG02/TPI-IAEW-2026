#!/bin/sh
# Corre el plan de JMeter en modo no-GUI dentro de Docker (servicio "jmeter", perfil "carga")
# y genera el reporte HTML (p90/p95/p99, throughput, errores) en docs/evidencias/carga/reporte.
set -e
# El log de JMeter queda en /tmp del contenedor: registra las propiedades -J (incluido el client secret).

SALIDA=/resultados
rm -rf "$SALIDA/reporte" "$SALIDA/resultados.jtl"
TOKEN_URL="${TOKEN_URL:-https://${AUTH0_DOMAIN}/oauth/token}"

exec jmeter -n -t /carga/biblioteca.jmx \
  -Jhost="${API_HOST:-api}" -Jport="${API_PORT_INTERNO:-3000}" \
  -JtokenUrl="$TOKEN_URL" -Jaudience="$AUTH0_AUDIENCE" \
  -JclientId="$AUTH0_CLIENT_ID" -JclientSecret="$AUTH0_CLIENT_SECRET" \
  -Jthreads="${CARGA_THREADS:-20}" -Jrampup="${CARGA_RAMPUP:-20}" -Jduration="${CARGA_DURATION:-120}" \
  -Jjmeter.reportgenerator.overall_granularity=5000 \
  -l "$SALIDA/resultados.jtl" -j /tmp/jmeter.log \
  -e -o "$SALIDA/reporte"
