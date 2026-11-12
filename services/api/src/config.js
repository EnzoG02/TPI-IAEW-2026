// Configuración de la API a partir de variables de entorno (ver .env.example).

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno ${name}`);
  return value;
}

const auth0Domain = process.env.AUTH0_DOMAIN;

module.exports = {
  port: Number(process.env.PORT || 3000),
  databaseUrl: required('DATABASE_URL'),
  rabbitUrl: required('RABBITMQ_URL'),
  auth: {
    // AUTH0_ISSUER_BASE_URL permite apuntar a un emisor local en pruebas (tools/issuer-local).
    issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL || process.env.AUTH0_ISSUER || `https://${auth0Domain}/`,
    audience: required('AUTH0_AUDIENCE'),
  },
  apiKey: process.env.API_KEY,
};
