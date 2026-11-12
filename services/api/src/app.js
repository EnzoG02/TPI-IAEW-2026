// Aplicación Express: middlewares transversales, rutas del contrato y manejo de errores.
const express = require('express');
const swaggerUi = require('swagger-ui-express');
const { observeHttp } = require('./lib/observability');
const { document } = require('./lib/contract');
const { query } = require('./lib/db');
const { requireApiKey } = require('./middleware/apiKey');
const { errorHandler, notFoundRoute } = require('./middleware/errorHandler');

const app = express();
app.disable('x-powered-by');
app.use(observeHttp);
app.use(express.json({ limit: '100kb' }));

// Healthcheck público: 503 si la base no responde.
app.get('/health', async (req, res) => {
  try {
    await query('SELECT 1');
    res.json({ status: 'ok', service: 'api' });
  } catch {
    res.status(503).json({ status: 'degradado', service: 'api', db: 'sin conexión' });
  }
});

// Contrato y Swagger UI (públicos, solo lectura).
app.get('/api-docs/openapi.json', (req, res) => res.json(document));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(document, { customSiteTitle: 'API Biblioteca digital' }));

// Endpoint de comparación con x-api-key (no usa OAuth 2.0).
app.get('/status/api-key', requireApiKey, (req, res) => res.json({ status: 'autenticado con api key' }));

app.use('/titulos', require('./routes/titulos'));
app.use('/usuarios', require('./routes/usuarios'));
app.use('/prestamos', require('./routes/prestamos'));
app.use('/', require('./routes/consultas'));

app.use(notFoundRoute);
app.use(errorHandler);

module.exports = app;
