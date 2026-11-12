// Validación de entrada: body contra el schema del contrato, y parámetros de path/query.
const { schemaValidator } = require('../lib/contract');
const { badRequest } = require('../lib/errors');

function describe(errors) {
  return errors
    .map((e) => `${e.instancePath ? e.instancePath.slice(1).replace(/\//g, '.') : 'body'} ${e.message}`)
    .join('; ');
}

function validateBody(schemaName) {
  const validate = schemaValidator(schemaName);
  return (req, res, next) => {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return next(badRequest('El cuerpo debe ser un objeto JSON'));
    }
    if (!validate(req.body)) return next(badRequest(describe(validate.errors)));
    return next();
  };
}

function positiveInt(value, name) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1) throw badRequest(`${name} debe ser un entero mayor a 0`);
  return number;
}

function idParam(req) {
  return positiveInt(req.params.id, 'id');
}

function optionalInt(value, name) {
  return value === undefined ? undefined : positiveInt(value, name);
}

function optionalEnum(value, name, allowed) {
  if (value === undefined) return undefined;
  if (!allowed.includes(value)) throw badRequest(`${name} debe ser uno de: ${allowed.join(', ')}`);
  return value;
}

function optionalBool(value, name) {
  if (value === undefined) return undefined;
  if (value !== 'true' && value !== 'false') throw badRequest(`${name} debe ser true o false`);
  return value === 'true';
}

function pagination(query) {
  const page = query.page === undefined ? 1 : positiveInt(query.page, 'page');
  const pageSize = query.pageSize === undefined ? 20 : positiveInt(query.pageSize, 'pageSize');
  if (pageSize > 100) throw badRequest('pageSize debe ser como máximo 100');
  return { page, pageSize, offset: (page - 1) * pageSize };
}

module.exports = { validateBody, idParam, optionalInt, optionalEnum, optionalBool, pagination };
