// Emisor JWT local SOLO para pruebas automatizadas y CI (no es Auth0 y no se usa en la demo).
// Imita lo mínimo de Auth0: POST /oauth/token (client_credentials), discovery OIDC y JWKS.
// Firma RS256 con una clave que se genera al arrancar. Adaptado de la validación de la clase 07.
const http = require('node:http');
const { generateKeyPairSync, sign } = require('node:crypto');

const ISSUER = process.env.ISSUER || 'http://issuer:8080/';
const AUDIENCE = process.env.AUDIENCE || 'https://api.biblioteca.local';
const TTL = Number(process.env.TOKEN_TTL || 3600);
const SECRET = process.env.LOCAL_CLIENT_SECRET || 'local-secret';
const LECTURA = ['read:titulos', 'read:usuarios', 'read:prestamos'];
const CLIENTES = {
  'local-cliente': [...LECTURA, 'write:titulos', 'write:usuarios', 'write:prestamos'],
  'local-lector': LECTURA,
};

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'issuer-local', alg: 'RS256', use: 'sig' };
const b64 = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');

function token(clientId, ttl) {
  const now = Math.floor(Date.now() / 1000);
  const input = `${b64({ alg: 'RS256', typ: 'JWT', kid: jwk.kid })}.${b64({
    iss: ISSUER, aud: AUDIENCE, sub: `${clientId}@clients`, azp: clientId,
    scope: CLIENTES[clientId].join(' '), gty: 'client-credentials', iat: now, exp: now + ttl,
  })}`;
  return `${input}.${sign('RSA-SHA256', Buffer.from(input), privateKey).toString('base64url')}`;
}

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

http.createServer((req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  if (pathname === '/.well-known/openid-configuration') {
    return send(res, 200, { issuer: ISSUER, jwks_uri: `${ISSUER}.well-known/jwks.json`, token_endpoint: `${ISSUER}oauth/token` });
  }
  if (pathname === '/.well-known/jwks.json') return send(res, 200, { keys: [jwk] });
  if (pathname === '/oauth/token' && req.method === 'POST') {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => {
      let body;
      try {
        body = req.headers['content-type']?.includes('json') ? JSON.parse(raw) : Object.fromEntries(new URLSearchParams(raw));
      } catch {
        return send(res, 400, { error: 'invalid_request' });
      }
      if (body.grant_type !== 'client_credentials') return send(res, 400, { error: 'unsupported_grant_type' });
      if (!CLIENTES[body.client_id] || body.client_secret !== SECRET) return send(res, 401, { error: 'access_denied' });
      if (body.audience !== AUDIENCE) return send(res, 403, { error: 'access_denied', error_description: 'audience inválida' });
      // expires_in opcional (solo emisor local) para probar el rechazo de tokens vencidos.
      const ttl = Number(body.expires_in) > 0 ? Number(body.expires_in) : TTL;
      return send(res, 200, {
        access_token: token(body.client_id, ttl), scope: CLIENTES[body.client_id].join(' '), expires_in: ttl, token_type: 'Bearer',
      });
    });
    return undefined;
  }
  return send(res, 404, { error: 'not_found' });
}).listen(8080, () => console.log(JSON.stringify({ level: 'info', 'service.name': 'issuer-local', event: 'issuer.iniciado', issuer: ISSUER })));
