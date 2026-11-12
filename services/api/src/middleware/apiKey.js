// x-api-key: solo para el endpoint de comparación /status/api-key (no reemplaza a OAuth 2.0).
const crypto = require('node:crypto');
const config = require('../config');
const { AppError } = require('../lib/errors');

const digest = (value) => crypto.createHash('sha256').update(String(value)).digest();

function requireApiKey(req, res, next) {
  if (!config.apiKey) return next(new AppError(500, 'INTERNO', 'API_KEY no está configurada en el servidor'));
  const received = req.get('x-api-key');
  // Comparación en tiempo constante sobre hashes de igual longitud.
  if (!received || !crypto.timingSafeEqual(digest(received), digest(config.apiKey))) {
    return next(new AppError(401, 'NO_AUTENTICADO', 'x-api-key ausente o inválida'));
  }
  return next();
}

module.exports = { requireApiKey };
