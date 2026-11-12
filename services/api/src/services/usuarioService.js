// Reglas de Usuario: traducción de duplicados y de borrado con historial.
const { PG } = require('../lib/db');
const { notFound, conflict } = require('../lib/errors');
const usuarios = require('../repositories/usuarios');

function traducir(error, email) {
  if (error.code === PG.UNIQUE_VIOLATION) return conflict('EMAIL_DUPLICADO', `Ya existe un usuario con email ${email}`);
  return error;
}

async function crear(input) {
  try {
    return await usuarios.crear(input);
  } catch (error) {
    throw traducir(error, input.email);
  }
}

async function actualizar(id, input) {
  let usuario;
  try {
    usuario = await usuarios.actualizar(id, input);
  } catch (error) {
    throw traducir(error, input.email);
  }
  if (!usuario) throw notFound('USUARIO_NO_ENCONTRADO', `No existe el usuario ${id}`);
  return usuario;
}

async function eliminar(id) {
  try {
    if (!(await usuarios.eliminar(id))) throw notFound('USUARIO_NO_ENCONTRADO', `No existe el usuario ${id}`);
  } catch (error) {
    if (error.code === PG.FOREIGN_KEY_VIOLATION) {
      throw conflict('USUARIO_CON_HISTORIAL',
        `El usuario ${id} tiene préstamos o reservas registrados; bloquearlo en lugar de eliminarlo`);
    }
    throw error;
  }
}

module.exports = { crear, actualizar, eliminar };
