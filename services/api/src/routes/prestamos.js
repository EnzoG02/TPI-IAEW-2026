const express = require('express');
const { requireScope } = require('../middleware/auth');
const { validateBody, idParam, optionalInt, optionalEnum, pagination } = require('../middleware/validate');
const { notFound } = require('../lib/errors');
const prestamos = require('../repositories/prestamos');
const service = require('../services/prestamoService');

const ESTADOS = ['ACTIVO', 'DEVUELTO', 'VENCIDO'];
const router = express.Router();

router.get('/', requireScope('read:prestamos'), async (req, res) => {
  const filtros = {
    estado: optionalEnum(req.query.estado, 'estado', ESTADOS),
    usuarioId: optionalInt(req.query.usuarioId, 'usuarioId'),
    ...pagination(req.query),
  };
  res.json(await prestamos.listar(filtros));
});

// Transacción multi-paso: 201 préstamo creado, 202 quedó en lista de espera.
router.post('/', requireScope('write:prestamos'), validateBody('PrestamoInput'), async (req, res) => {
  const { status, body } = await service.prestar(req.body);
  if (status === 201) res.location(`/prestamos/${body.id}`);
  res.status(status).json(body);
});

router.get('/:id', requireScope('read:prestamos'), async (req, res) => {
  const id = idParam(req);
  const prestamo = await prestamos.obtener(id);
  if (!prestamo) throw notFound('PRESTAMO_NO_ENCONTRADO', `No existe el préstamo ${id}`);
  res.json(prestamo);
});

router.post('/:id/devolucion', requireScope('write:prestamos'), async (req, res) => {
  res.json(await service.devolver(idParam(req)));
});

module.exports = router;
