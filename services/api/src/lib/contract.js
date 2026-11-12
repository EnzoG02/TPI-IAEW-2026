// Carga el contrato OpenAPI (api/openapi.yaml) y compila sus schemas con Ajv.
// El contrato es la única fuente de verdad: la API valida los bodies contra los mismos schemas que publica.
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const Ajv2020 = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const CANDIDATES = [
  process.env.OPENAPI_PATH,
  path.resolve(__dirname, '../../openapi.yaml'), // imagen Docker: /app/openapi.yaml
  path.resolve(__dirname, '../../../../api/openapi.yaml'), // repo: api/openapi.yaml
].filter(Boolean);

const file = CANDIDATES.find((candidate) => fs.existsSync(candidate));
if (!file) throw new Error(`No se encontró openapi.yaml (buscado en: ${CANDIDATES.join(', ')})`);

const document = yaml.load(fs.readFileSync(file, 'utf8'));

const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
ajv.addFormat('int64', { type: 'number', validate: Number.isSafeInteger });
ajv.addSchema(document, 'openapi');

function schemaValidator(name) {
  const validate = ajv.getSchema(`openapi#/components/schemas/${name}`);
  if (!validate) throw new Error(`El contrato no define el schema ${name}`);
  return validate;
}

module.exports = { document, schemaValidator };
