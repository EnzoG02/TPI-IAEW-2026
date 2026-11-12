// Resource server OAuth 2.0: valida el JWT (firma RS256 vía JWKS, iss, aud, exp) y el scope del endpoint.
// Mismo enfoque que el laboratorio de la clase 07 (express-oauth2-jwt-bearer). Ver ADR 003.
const { auth, requiredScopes } = require('express-oauth2-jwt-bearer');
const config = require('../config');

const validateAccessToken = auth({
  issuerBaseURL: config.auth.issuerBaseURL,
  audience: config.auth.audience,
  tokenSigningAlg: 'RS256',
});

function requireScope(scope) {
  const remember = (req, res, next) => {
    req.requiredScope = scope; // para el mensaje del 403 SIN_PERMISO
    next();
  };
  return [remember, validateAccessToken, requiredScopes(scope)];
}

module.exports = { validateAccessToken, requireScope };
