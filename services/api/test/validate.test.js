// Tests unitarios de la validación de entrada contra los schemas de api/openapi.yaml.
const test = require('node:test');
const assert = require('node:assert/strict');
const { validateBody, pagination, optionalEnum, optionalBool } = require('../src/middleware/validate');

function correr(middleware, body) {
  let error;
  middleware({ body }, {}, (err) => { error = err; });
  return error;
}

test('TituloInput válido pasa', () => {
  assert.equal(correr(validateBody('TituloInput'), { titulo: 'Rayuela', autor: 'Cortázar', cupoTotal: 2 }), undefined);
});

test('TituloInput inválido devuelve 400 VALIDACION con el detalle', () => {
  const error = correr(validateBody('TituloInput'), { titulo: '', autor: 'X', cupoTotal: 0 });
  assert.equal(error.status, 400);
  assert.equal(error.code, 'VALIDACION');
  assert.match(error.message, /cupoTotal/);
});

test('UsuarioInput exige un email válido y un estado del enum', () => {
  assert.equal(correr(validateBody('UsuarioInput'), { nombre: 'A', email: 'no-email' }).code, 'VALIDACION');
  assert.equal(correr(validateBody('UsuarioInput'), { nombre: 'A', email: 'a@b.com', estado: 'OTRO' }).code, 'VALIDACION');
  assert.equal(correr(validateBody('UsuarioInput'), { nombre: 'A', email: 'a@b.com', estado: 'BLOQUEADO' }), undefined);
});

test('PrestamoInput: diasPrestamo entre 1 y 60, ids enteros', () => {
  assert.equal(correr(validateBody('PrestamoInput'), { usuarioId: 1, tituloId: 1, diasPrestamo: 61 }).code, 'VALIDACION');
  assert.equal(correr(validateBody('PrestamoInput'), { usuarioId: '1', tituloId: 1 }).code, 'VALIDACION');
  assert.equal(correr(validateBody('PrestamoInput'), { usuarioId: 1, tituloId: 1, unirseListaEspera: true }), undefined);
});

test('el body tiene que ser un objeto JSON', () => {
  assert.equal(correr(validateBody('TituloInput'), [1, 2]).code, 'VALIDACION');
  assert.equal(correr(validateBody('TituloInput'), undefined).code, 'VALIDACION');
});

test('pagination aplica defaults y límites', () => {
  assert.deepEqual(pagination({}), { page: 1, pageSize: 20, offset: 0 });
  assert.deepEqual(pagination({ page: '3', pageSize: '10' }), { page: 3, pageSize: 10, offset: 20 });
  assert.throws(() => pagination({ pageSize: '101' }), /pageSize/);
  assert.throws(() => pagination({ page: '0' }), /page/);
});

test('filtros de query: enum y booleano', () => {
  assert.equal(optionalEnum('ACTIVO', 'estado', ['ACTIVO', 'DEVUELTO']), 'ACTIVO');
  assert.throws(() => optionalEnum('X', 'estado', ['ACTIVO']), /estado/);
  assert.equal(optionalBool('true', 'soloDisponibles'), true);
  assert.throws(() => optionalBool('si', 'soloDisponibles'), /soloDisponibles/);
});
