// Job periódico de vencimientos (ADR 004): la base es la fuente de verdad de las fechas.
//  1. Recordatorio para préstamos ACTIVO que vencen en las próximas 24 h.
//  2. Préstamos ACTIVO con fecha pasada pasan a VENCIDO.
//  3. Todo préstamo VENCIDO tiene su aviso VENCIMIENTO y su multa.
// Cada INSERT usa ON CONFLICT DO NOTHING: correr el job dos veces no duplica nada.

async function ejecutar(db, { multaMonto }) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const recordatorios = await client.query(
      `INSERT INTO avisos (usuario_id, prestamo_id, tipo, canal)
       SELECT usuario_id, id, 'RECORDATORIO_DEVOLUCION', 'LOG' FROM prestamos
        WHERE estado = 'ACTIVO' AND fecha_vencimiento BETWEEN now() AND now() + interval '24 hours'
       ON CONFLICT DO NOTHING RETURNING prestamo_id`,
    );
    const vencidos = await client.query(
      `UPDATE prestamos SET estado = 'VENCIDO'
        WHERE estado = 'ACTIVO' AND fecha_vencimiento < now() RETURNING id`,
    );
    const avisosVencimiento = await client.query(
      `INSERT INTO avisos (usuario_id, prestamo_id, tipo, canal)
       SELECT usuario_id, id, 'VENCIMIENTO', 'LOG' FROM prestamos WHERE estado = 'VENCIDO'
       ON CONFLICT DO NOTHING RETURNING prestamo_id`,
    );
    const multas = await client.query(
      `INSERT INTO multas (prestamo_id, usuario_id, monto)
       SELECT id, usuario_id, $1 FROM prestamos WHERE estado = 'VENCIDO'
       ON CONFLICT DO NOTHING RETURNING prestamo_id`,
      [multaMonto],
    );
    await client.query('COMMIT');
    return {
      recordatorios: recordatorios.rowCount,
      vencidos: vencidos.rowCount,
      avisosVencimiento: avisosVencimiento.rowCount,
      multas: multas.rowCount,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { ejecutar };
