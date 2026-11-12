# Imagen de la API. Se construye desde la raíz del repo (context: .) porque incluye
# el contrato (api/openapi.yaml) y las migraciones/seed (db/), que la API usa en runtime.
FROM node:22.17.0-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY services/api/package*.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund
COPY services/api/src ./src
COPY services/api/scripts ./scripts
COPY api/openapi.yaml ./openapi.yaml
COPY db ./db
USER node
EXPOSE 3000
# node directo (no npm start) para que stdout tenga solo los logs JSON de la app.
CMD ["node", "--require", "./src/telemetry.js", "src/server.js"]
