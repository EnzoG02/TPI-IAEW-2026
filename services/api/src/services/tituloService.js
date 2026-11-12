// Reglas de Titulo que requieren transacción o traducción de errores de la base.
const { withTransaction, PG } = require('../lib/db');
const { notFound, conflict } = require('../lib/errors');
const titulos = require('../repositories/titulos');

function traducir(error, isbn) {
  if (error.code === PG.UNIQUE_VIOLATION) return conflict('ISBN_DUPLICADO', `Ya existe un título con ISBN ${isbn}`);
  return error;
}

async function crear(input) {
  try {
    return await titulos.crear(input);
  } catch (error) {
    throw traducir(error, input.isbn);
  }
}

// PUT: recalcula cupoDisponible = cupoTotal − préstamos sin devolver (ACTIVO o VENCIDO).
async function actualizar(id, input) {
  try {
    return await withTransaction(async (client) => {
      const actual = await titulos.bloquear(client, id);
      if (!actual) throw notFound('TITULO_NO_ENCONTRADO', `No existe el título ${id}`);
      const prestados = await titulos.prestamosSinDevolver(client, id);
      if (input.cupoTotal < prestados) {
        throw conflict('CUPO_INVALIDO',
          `El título ${id} tiene ${prestados} préstamo(s) sin devolver; cupoTotal no puede ser menor`);
      }
      return titulos.actualizar(client, id, { ...input, cupoDisponible: input.cupoTotal - prestados });
    });
  } catch (error) {
    throw traducir(error, input.isbn);
  }
}

async function eliminar(id) {
  try {
    if (!(await titulos.eliminar(id))) throw notFound('TITULO_NO_ENCONTRADO', `No existe el título ${id}`);
  } catch (error) {
    if (error.code === PG.FOREIGN_KEY_VIOLATION) {
      throw conflict('TITULO_CON_HISTORIAL', `El título ${id} tiene préstamos o reservas registrados y no puede eliminarse`);
    }
    throw error;
  }
}

module.exports = { crear, actualizar, eliminar };
