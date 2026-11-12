FROM node:22.17.0-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund
COPY src ./src
USER node
# node directo (no npm start) para que stdout tenga solo los logs JSON de la app.
CMD ["node", "--require", "./src/telemetry.js", "src/index.js"]
