// Lecturas de la lista de espera y de los avisos que genera el worker (efecto visible del flujo asincrónico).
const express = require('express');
const { requireScope } = require('../middleware/auth');
const { optionalInt, optionalEnum, pagination } = require('../middleware/validate');
const reservas = require('../repositories/reservas');
const avisos = require('../repositories/avisos');

const ESTADOS_RESERVA = ['EN_ESPERA', 'NOTIFICADA', 'CUMPLIDA', 'CANCELADA'];
const TIPOS_AVISO = ['PRESTAMO_CONFIRMADO', 'RECORDATORIO_DEVOLUCION', 'VENCIMIENTO', 'CUPO_DISPONIBLE'];
const router = express.Router();

router.get('/reservas', requireScope('read:prestamos'), async (req, res) => {
  res.json(await reservas.listar({
    tituloId: optionalInt(req.query.tituloId, 'tituloId'),
    estado: optionalEnum(req.query.estado, 'estado', ESTADOS_RESERVA),
  }));
});

router.get('/avisos', requireScope('read:prestamos'), async (req, res) => {
  res.json(await avisos.listar({
    usuarioId: optionalInt(req.query.usuarioId, 'usuarioId'),
    prestamoId: optionalInt(req.query.prestamoId, 'prestamoId'),
    tipo: optionalEnum(req.query.tipo, 'tipo', TIPOS_AVISO),
    ...pagination(req.query),
  }));
});

module.exports = router;
