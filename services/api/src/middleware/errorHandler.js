// Traduce cualquier error al formato { code, message, correlationId } con el código HTTP del contrato.
const { AppError, sendError } = require('../lib/errors');
const { log } = require('../lib/observability');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    if (err.status >= 500) log('error.interno', { error_message: err.message }, 'error');
    return sendError(res, err.status, err.code, err.message);
  }
  // Errores de express-oauth2-jwt-bearer (InvalidRequestError = header Authorization mal formado).
  if (err.status === 401 || err.name === 'InvalidRequestError') {
    return sendError(res, 401, 'NO_AUTENTICADO', 'Token ausente, inválido o expirado');
  }
  if (err.status === 403) {
    const scope = req.requiredScope ? `Se requiere el scope ${req.requiredScope}` : 'Permisos insuficientes';
    return sendError(res, 403, 'SIN_PERMISO', scope);
  }
  if (err.type === 'entity.parse.failed') {
    return sendError(res, 400, 'VALIDACION', 'El cuerpo no es un JSON válido');
  }
  log('error.no_controlado', { error_message: err.message, error_type: err.constructor.name }, 'error');
  return sendError(res, 500, 'INTERNO', 'Error interno');
}

function notFoundRoute(req, res) {
  res.locals.sinRuta = true;
  return sendError(res, 404, 'RUTA_NO_ENCONTRADA', `No existe ${req.method} ${req.path}`);
}

module.exports = { errorHandler, notFoundRoute };
