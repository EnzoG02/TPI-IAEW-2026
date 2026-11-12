// Gateway WebSocket de la lista de espera (ADR 005).
// GET /ws/lista-espera?usuarioId={id} con Authorization: Bearer <token> (scope read:prestamos).
// Cuando una devolución libera cupo, la API avisa por acá al primer usuario de la cola.
const { WebSocketServer } = require('ws');
const { createRemoteJWKSet, jwtVerify } = require('jose');
const config = require('../config');
const { log, correlationId } = require('../lib/observability');

const PATH = '/ws/lista-espera';
const SCOPE = 'read:prestamos';
const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });
const suscripciones = new Map(); // usuarioId -> Set<WebSocket>

// Descubre issuer y jwks_uri del servidor de autorización (Auth0 o el emisor local de pruebas).
let verifierPromise;
function verifier() {
  if (!verifierPromise) {
    const base = config.auth.issuerBaseURL.replace(/\/?$/, '/');
    verifierPromise = fetch(`${base}.well-known/openid-configuration`)
      .then((r) => {
        if (!r.ok) throw new Error(`discovery respondió ${r.status}`);
        return r.json();
      })
      .then((metadata) => ({ issuer: metadata.issuer, jwks: createRemoteJWKSet(new URL(metadata.jwks_uri)) }))
      .catch((error) => {
        verifierPromise = undefined;
        throw error;
      });
  }
  return verifierPromise;
}

async function autenticar(req) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return { status: 401, motivo: 'token ausente' };
  try {
    const { issuer, jwks } = await verifier();
    const { payload } = await jwtVerify(token, jwks, { issuer, audience: config.auth.audience, algorithms: ['RS256'] });
    const scopes = String(payload.scope || '').split(' ');
    if (!scopes.includes(SCOPE)) return { status: 403, motivo: `se requiere el scope ${SCOPE}` };
    return { status: 200, sub: payload.sub };
  } catch (error) {
    return { status: 401, motivo: error.code || error.message };
  }
}

function rechazar(socket, status, motivo) {
  const text = { 400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found' }[status];
  socket.write(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\nContent-Type: text/plain\r\n\r\n${motivo}`);
  socket.destroy();
  log('ws.rechazado', { status, motivo }, 'warn');
}

function attach(server) {
  server.on('upgrade', async (req, socket, head) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname !== PATH) return rechazar(socket, 404, 'ruta inexistente');
    const usuarioId = Number(url.searchParams.get('usuarioId'));
    if (!Number.isSafeInteger(usuarioId) || usuarioId < 1) return rechazar(socket, 400, 'usuarioId inválido');
    const resultado = await autenticar(req);
    if (resultado.status !== 200) return rechazar(socket, resultado.status, resultado.motivo);

    return wss.handleUpgrade(req, socket, head, (ws) => {
      if (!suscripciones.has(usuarioId)) suscripciones.set(usuarioId, new Set());
      suscripciones.get(usuarioId).add(ws);
      ws.isAlive = true;
      ws.on('pong', () => { ws.isAlive = true; });
      ws.on('close', () => {
        suscripciones.get(usuarioId)?.delete(ws);
        log('ws.desconectado', { usuario_id: usuarioId });
      });
      ws.send(JSON.stringify({ type: 'suscripcion.ok', usuarioId }));
      log('ws.suscripto', { usuario_id: usuarioId, cliente: resultado.sub });
    });
  });

  // Heartbeat: cierra conexiones muertas cada 30 s.
  const heartbeat = setInterval(() => {
    for (const sockets of suscripciones.values()) {
      for (const ws of sockets) {
        if (!ws.isAlive) ws.terminate();
        else { ws.isAlive = false; ws.ping(); }
      }
    }
  }, 30000);
  heartbeat.unref();
}

// Envía el mensaje (schema MensajeListaEspera del contrato) a todos los sockets del usuario.
function notificar(usuarioId, mensaje) {
  const payload = JSON.stringify({ ...mensaje, correlationId: correlationId() });
  let enviados = 0;
  for (const ws of suscripciones.get(usuarioId) || []) {
    if (ws.readyState === ws.OPEN) {
      ws.send(payload);
      enviados += 1;
    }
  }
  log('ws.aviso_enviado', { usuario_id: usuarioId, reserva_id: mensaje.reservaId, sockets: enviados });
  return enviados;
}

function cerrar() {
  for (const ws of wss.clients) ws.close(1001, 'servidor detenido');
}

module.exports = { attach, notificar, cerrar, PATH };
