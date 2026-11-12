#!/bin/sh
# Corre la colección con Newman dentro de Docker (servicio "newman", perfil "tests").
# Los secretos llegan por variables de entorno desde .env; los archivos versionados no tienen secretos.
set -e

ENV_FILE="/etc/newman/${NEWMAN_ENV:-auth0.postman_environment.example.json}"
TOKEN_URL="${TOKEN_URL:-https://${AUTH0_DOMAIN}/oauth/token}"
REPORTES=/reportes

set -- run /etc/newman/biblioteca.postman_collection.json -e "$ENV_FILE" \
  --env-var "baseUrl=${BASE_URL:-http://api:3000}" \
  --env-var "tokenUrl=${TOKEN_URL}" \
  --env-var "audience=${AUTH0_AUDIENCE}" \
  --timeout-request 10000 \
  -r cli,htmlextra \
  --reporter-htmlextra-export "$REPORTES/newman-report.html" \
  --reporter-htmlextra-title "Biblioteca digital - Newman" \
  --reporter-htmlextra-skipSensitiveData
# skipSensitiveData: el HTML no guarda headers ni bodies, así que no quedan tokens en el reporte.
# (No se usa el reporter json: incluye los access tokens.)

# Solo se pisan las variables del environment si vienen definidas en .env.
[ -n "$AUTH0_CLIENT_ID" ] && set -- "$@" --env-var "clientId=${AUTH0_CLIENT_ID}"
[ -n "$AUTH0_CLIENT_SECRET" ] && set -- "$@" --env-var "clientSecret=${AUTH0_CLIENT_SECRET}"
[ -n "$AUTH0_LECTOR_CLIENT_ID" ] && set -- "$@" --env-var "lectorClientId=${AUTH0_LECTOR_CLIENT_ID}"
[ -n "$AUTH0_LECTOR_CLIENT_SECRET" ] && set -- "$@" --env-var "lectorClientSecret=${AUTH0_LECTOR_CLIENT_SECRET}"
[ -n "$API_KEY" ] && set -- "$@" --env-var "apiKey=${API_KEY}"

exec newman "$@"
