// Errores de dominio con el formato único del contrato: { code, message, correlationId } (ADR 006).
const { correlationId } = require('./observability');

class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const notFound = (code, message) => new AppError(404, code, message);
const conflict = (code, message) => new AppError(409, code, message);
const forbidden = (code, message) => new AppError(403, code, message);
const badRequest = (message) => new AppError(400, 'VALIDACION', message);

function sendError(res, status, code, message) {
  return res.status(status).json({ code, message, correlationId: correlationId() });
}

module.exports = { AppError, notFound, conflict, forbidden, badRequest, sendError };
