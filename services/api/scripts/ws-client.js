// Cliente de demo del WebSocket de lista de espera.
// Uso (con el stack levantado):  docker compose run --rm tools node scripts/ws-client.js 2
// Pide un token con client_credentials (o usa ACCESS_TOKEN), se suscribe como el usuario indicado
// y muestra cada mensaje que llega. Cortar con Ctrl+C.
const WebSocket = require('ws');

const usuarioId = process.argv[2] || '2';
const apiUrl = process.env.API_URL || 'http://localhost:3000';
const tokenUrl = process.env.TOKEN_URL || `https://${process.env.AUTH0_DOMAIN}/oauth/token`;

async function obtenerToken() {
  if (process.env.ACCESS_TOKEN) return process.env.ACCESS_TOKEN;
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: process.env.AUTH0_CLIENT_ID,
      client_secret: process.env.AUTH0_CLIENT_SECRET,
      audience: process.env.AUTH0_AUDIENCE,
    }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`No se pudo obtener el token (${response.status}): ${JSON.stringify(body)}`);
  return body.access_token;
}

(async () => {
  const token = await obtenerToken();
  const url = `${apiUrl.replace(/^http/, 'ws')}/ws/lista-espera?usuarioId=${usuarioId}`;
  const ws = new WebSocket(url, { headers: { Authorization: `Bearer ${token}` } });
  ws.on('open', () => console.log(`[ws] conectado a ${url}`));
  ws.on('message', (data) => console.log(`[ws] ${new Date().toISOString()} ${data}`));
  ws.on('unexpected-response', (req, res) => {
    console.error(`[ws] rechazado: HTTP ${res.statusCode}`);
    process.exit(1);
  });
  ws.on('close', (code) => console.log(`[ws] cerrado (${code})`));
  ws.on('error', (error) => console.error(`[ws] error: ${error.message}`));
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
