const express = require('express');
const { requireScope } = require('../middleware/auth');
const { validateBody, idParam, optionalEnum, pagination } = require('../middleware/validate');
const { notFound } = require('../lib/errors');
const usuarios = require('../repositories/usuarios');
const service = require('../services/usuarioService');

const ESTADOS = ['HABILITADO', 'BLOQUEADO'];
const router = express.Router();

router.get('/', requireScope('read:usuarios'), async (req, res) => {
  const filtros = { estado: optionalEnum(req.query.estado, 'estado', ESTADOS), ...pagination(req.query) };
  res.json(await usuarios.listar(filtros));
});

router.post('/', requireScope('write:usuarios'), validateBody('UsuarioInput'), async (req, res) => {
  const usuario = await service.crear(req.body);
  res.status(201).location(`/usuarios/${usuario.id}`).json(usuario);
});

router.get('/:id', requireScope('read:usuarios'), async (req, res) => {
  const id = idParam(req);
  const usuario = await usuarios.obtener(id);
  if (!usuario) throw notFound('USUARIO_NO_ENCONTRADO', `No existe el usuario ${id}`);
  res.json(usuario);
});

router.put('/:id', requireScope('write:usuarios'), validateBody('UsuarioInput'), async (req, res) => {
  res.json(await service.actualizar(idParam(req), req.body));
});

router.delete('/:id', requireScope('write:usuarios'), async (req, res) => {
  await service.eliminar(idParam(req));
  res.status(204).end();
});

module.exports = router;
