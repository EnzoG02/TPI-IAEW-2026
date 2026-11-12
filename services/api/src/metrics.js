// Métricas de negocio que pide el dominio: préstamos activos y vencidos, reservas en espera y avisos.
// Son gauges observables: en cada exportación (cada 5 s) se consultan a la base.
const { meter, log } = require('./lib/observability');
const { query } = require('./lib/db');

const prestamosActivos = meter.createObservableGauge('biblioteca_prestamos_activos', {
  description: 'Préstamos en estado ACTIVO',
});
const prestamosVencidos = meter.createObservableGauge('biblioteca_prestamos_vencidos', {
  description: 'Préstamos en estado VENCIDO',
});
const reservasEnEspera = meter.createObservableGauge('biblioteca_reservas_en_espera', {
  description: 'Reservas EN_ESPERA en listas de espera',
});
const avisos = meter.createObservableGauge('biblioteca_avisos', {
  description: 'Avisos enviados por tipo (acumulado)',
});

meter.addBatchObservableCallback(async (observer) => {
  try {
    const [estado, porTipo] = await Promise.all([
      query(`SELECT
          (SELECT count(*) FROM prestamos WHERE estado = 'ACTIVO')::int AS activos,
          (SELECT count(*) FROM prestamos WHERE estado = 'VENCIDO')::int AS vencidos,
          (SELECT count(*) FROM reservas WHERE estado = 'EN_ESPERA')::int AS en_espera`),
      query('SELECT tipo, count(*)::int AS n FROM avisos GROUP BY tipo'),
    ]);
    const row = estado.rows[0];
    observer.observe(prestamosActivos, row.activos);
    observer.observe(prestamosVencidos, row.vencidos);
    observer.observe(reservasEnEspera, row.en_espera);
    for (const { tipo, n } of porTipo.rows) observer.observe(avisos, n, { tipo });
  } catch (error) {
    log('metricas.error', { error_message: error.message }, 'warn');
  }
}, [prestamosActivos, prestamosVencidos, reservasEnEspera, avisos]);
