# Configuración de Auth0

La API es un *resource server*: valida tokens JWT emitidos por Auth0 (firma RS256 vía JWKS, `iss`, `aud`, `exp`)
y exige un scope por endpoint. Los clientes son aplicaciones **Machine to Machine** que obtienen el token con el
flujo OAuth 2.0 `client_credentials`. Decisión documentada en el [ADR 003](adr/003-seguridad-oauth2-jwt-auth0.md).

> Los `Client Secret` **nunca** se suben al repositorio: van solo en `.env` (ignorado por git) o en el environment
> local de Postman.

## 1. Crear el tenant

1. Crear una cuenta gratuita en <https://auth0.com> (o usar una existente).
2. Crear un tenant. Su dominio queda con la forma `TU_TENANT.us.auth0.com`.

## 2. Crear la API (audience, issuer y scopes)

*Applications → APIs → Create API*

| Campo | Valor |
|---|---|
| Name | `Biblioteca digital` |
| Identifier (audience) | `https://api.biblioteca.local` |
| JSON Web Token Signing Algorithm | `RS256` |

En la pestaña **Settings** de la API:

| Campo | Valor | Por qué |
|---|---|---|
| Maximum Access Token Lifetime | `3600` | El token expira en 1 h; la API rechaza tokens vencidos (401). |

En la pestaña **Permissions** agregar los scopes del contrato:

| Scope | Descripción |
|---|---|
| `read:titulos` | Leer títulos |
| `write:titulos` | Crear, modificar y eliminar títulos |
| `read:usuarios` | Leer usuarios |
| `write:usuarios` | Crear, modificar y eliminar usuarios |
| `read:prestamos` | Leer préstamos, reservas y avisos; suscribirse al WebSocket |
| `write:prestamos` | Crear préstamos y registrar devoluciones |

El **issuer** es `https://TU_TENANT.us.auth0.com/` (con la barra final).

## 3. Crear los clientes Machine to Machine

*Applications → Applications → Create Application → Machine to Machine Applications*

Se crean dos clientes para poder mostrar la autorización por scopes:

| Aplicación | API autorizada | Permisos | Uso |
|---|---|---|---|
| `biblioteca-cliente` | Biblioteca digital | los 6 scopes | Cliente completo (Postman, JMeter, demo) |
| `biblioteca-lector` | Biblioteca digital | solo `read:titulos`, `read:usuarios`, `read:prestamos` | Muestra el **403** al intentar escribir |

Al crear cada aplicación Auth0 pide elegir la API y tildar los permisos. Si ya existe, se cambia en
*Applications → (la app) → APIs → Biblioteca digital → Permissions*.

De cada aplicación anotar **Client ID** y **Client Secret** (pestaña *Settings*).

## 4. Cargar los valores en `.env`

```dotenv
AUTH0_DOMAIN=TU_TENANT.us.auth0.com
AUTH0_AUDIENCE=https://api.biblioteca.local

# Solo para las pruebas (Newman, JMeter, scripts de demo). No se suben al repo.
AUTH0_CLIENT_ID=...
AUTH0_CLIENT_SECRET=...
AUTH0_LECTOR_CLIENT_ID=...
AUTH0_LECTOR_CLIENT_SECRET=...
```

La API solo necesita `AUTH0_DOMAIN` y `AUTH0_AUDIENCE`: con eso descarga las claves públicas del tenant
(`https://TU_TENANT.us.auth0.com/.well-known/jwks.json`) y valida firma, issuer y audience.

## 5. Obtener un token con `client_credentials`

```bash
curl --request POST \
  --url "https://$AUTH0_DOMAIN/oauth/token" \
  --header "content-type: application/json" \
  --data "{\"client_id\":\"$AUTH0_CLIENT_ID\",\"client_secret\":\"$AUTH0_CLIENT_SECRET\",\"audience\":\"$AUTH0_AUDIENCE\",\"grant_type\":\"client_credentials\"}"
```

Respuesta esperada:

```json
{
  "access_token": "eyJ...",
  "scope": "read:titulos write:titulos read:usuarios write:usuarios read:prestamos write:prestamos",
  "expires_in": 3600,
  "token_type": "Bearer"
}
```

El contenido del token se puede inspeccionar en <https://jwt.io>: `iss`, `aud`, `exp` y el claim `scope`.

## 6. Cuota del plan gratuito

El plan gratuito limita la cantidad de tokens M2M emitidos por mes. Por eso la colección de Postman y el plan de
JMeter piden **un token por corrida** y lo reutilizan hasta que vence.
