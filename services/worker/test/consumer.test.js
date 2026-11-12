// Tests unitarios del consumidor: decisión ack / reintento / DLQ sin RabbitMQ ni PostgreSQL reales.
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseEvento, retryCountOf, processMessage, PermanentMessageError,
} = require('../src/consumer');

const evento = { eventId: 'e-1', type: 'prestamo.creado', occurredAt: '2026-11-12T10:00:00Z', data: { id: 7 } };
const mensaje = (body, retry = 0) => ({
  content: Buffer.from(typeof body === 'string' ? body : JSON.stringify(body)),
  properties: { headers: { 'x-retry-count': retry } },
});

function canal() {
  const acks = [];
  return { acks, ack: (m) => acks.push(m) };
}

function deps({ insertRows = [{ id: 1, usuario_id: 2 }], existe = true, failDb = false, simulatedFailures = 0 } = {}) {
  const llamadas = { retry: [], dlq: [] };
  return {
    llamadas,
    db: {
      async query(sql) {
        if (failDb) throw new Error('db caída');
        if (sql.includes('INSERT INTO avisos')) return { rowCount: insertRows.length, rows: insertRows };
        return { rowCount: existe ? 1 : 0, rows: [] };
      },
    },
    log: () => {},
    config: { maxRetries: 3, retryDelayMs: 10, simulatedFailures },
    publishRetry: async (ch, m, count, reason) => llamadas.retry.push({ count, reason }),
    publishDlq: async (ch, m, reason) => llamadas.dlq.push(reason),
  };
}

test('parseEvento acepta un prestamo.creado válido', () => {
  assert.equal(parseEvento(Buffer.from(JSON.stringify(evento))).prestamoId, 7);
});

test('parseEvento rechaza JSON inválido y contratos incompletos como errores permanentes', () => {
  assert.throws(() => parseEvento(Buffer.from('{no-json')), PermanentMessageError);
  assert.throws(() => parseEvento(Buffer.from(JSON.stringify({ ...evento, type: 'otro' }))), PermanentMessageError);
  assert.throws(() => parseEvento(Buffer.from(JSON.stringify({ ...evento, data: {} }))), PermanentMessageError);
});

test('retryCountOf toma el header x-retry-count y por defecto es 0', () => {
  assert.equal(retryCountOf({ properties: { headers: { 'x-retry-count': 2 } } }), 2);
  assert.equal(retryCountOf({ properties: {} }), 0);
});

test('registra el aviso y hace ack', async () => {
  const ch = canal();
  const d = deps();
  assert.equal(await processMessage(mensaje(evento), ch, d), 'procesado');
  assert.equal(ch.acks.length, 1);
  assert.equal(d.llamadas.retry.length + d.llamadas.dlq.length, 0);
});

test('un evento repetido no duplica el aviso (idempotencia) y hace ack', async () => {
  const ch = canal();
  const d = deps({ insertRows: [] });
  assert.equal(await processMessage(mensaje(evento), ch, d), 'duplicado');
  assert.equal(ch.acks.length, 1);
});

test('préstamo inexistente: error permanente, va directo a la DLQ', async () => {
  const ch = canal();
  const d = deps({ insertRows: [], existe: false });
  assert.equal(await processMessage(mensaje(evento), ch, d), 'dlq');
  assert.match(d.llamadas.dlq[0], /permanente/);
  assert.equal(ch.acks.length, 1);
});

test('error transitorio: se reintenta con el contador incrementado', async () => {
  const ch = canal();
  const d = deps({ failDb: true });
  assert.equal(await processMessage(mensaje(evento, 1), ch, d), 'reintento');
  assert.deepEqual(d.llamadas.retry.map((r) => r.count), [2]);
  assert.equal(ch.acks.length, 1);
});

test('agotados los reintentos, el mensaje va a la DLQ', async () => {
  const ch = canal();
  const d = deps({ failDb: true });
  assert.equal(await processMessage(mensaje(evento, 3), ch, d), 'dlq');
  assert.match(d.llamadas.dlq[0], /reintentos agotados/);
});

test('la falla simulada afecta solo a los primeros N intentos', async () => {
  const d = deps({ simulatedFailures: 2 });
  assert.equal(await processMessage(mensaje(evento, 0), canal(), d), 'reintento');
  assert.equal(await processMessage(mensaje(evento, 1), canal(), d), 'reintento');
  assert.equal(await processMessage(mensaje(evento, 2), canal(), d), 'procesado');
});
