const express = require('express');
const { requireScope } = require('../middleware/auth');
const { validateBody, idParam, optionalBool, pagination } = require('../middleware/validate');
const { notFound } = require('../lib/errors');
const titulos = require('../repositories/titulos');
const service = require('../services/tituloService');

const router = express.Router();

router.get('/', requireScope('read:titulos'), async (req, res) => {
  const filtros = {
    autor: req.query.autor,
    soloDisponibles: optionalBool(req.query.soloDisponibles, 'soloDisponibles'),
    ...pagination(req.query),
  };
  res.json(await titulos.listar(filtros));
});

router.post('/', requireScope('write:titulos'), validateBody('TituloInput'), async (req, res) => {
  const titulo = await service.crear(req.body);
  res.status(201).location(`/titulos/${titulo.id}`).json(titulo);
});

router.get('/:id', requireScope('read:titulos'), async (req, res) => {
  const id = idParam(req);
  const titulo = await titulos.obtener(id);
  if (!titulo) throw notFound('TITULO_NO_ENCONTRADO', `No existe el título ${id}`);
  res.json(titulo);
});

router.put('/:id', requireScope('write:titulos'), validateBody('TituloInput'), async (req, res) => {
  res.json(await service.actualizar(idParam(req), req.body));
});

router.delete('/:id', requireScope('write:titulos'), async (req, res) => {
  await service.eliminar(idParam(req));
  res.status(204).end();
});

module.exports = router;
