# Ruleta con Pozo Acumulado

Juego de casino virtual con un pozo acumulado compartido. **Sin dinero real** en esta etapa (V0.x): el premio es virtual.

Especificación técnica completa (V0.1 a V0.3, con historial de auditoría): [`docs/spec/`](./docs/spec/).

## Estado del proyecto

**V0.3** — primera entrega con lógica de negocio real: autenticación completa (registro, verificación de email, login, refresh, logout) y los endpoints públicos `GET /api/game-info` y `GET /api/pot`. **El giro (`POST /api/spins`) todavía NO existe** — se divide deliberadamente en V0.3.1 (ver nota en la sección H de la spec: separar auth de spin/RNG permite auditar cada superficie de ataque con la profundidad que exige la spec).

## Stack

- **Frontend**: React + TypeScript + Vite
- **Backend**: Node.js + TypeScript + Fastify, [`@fastify/cookie`](https://github.com/fastify/fastify-cookie), [`@fastify/rate-limit`](https://github.com/fastify/fastify-rate-limit), [`argon2`](https://github.com/ranisalt/node-argon2) (Argon2id), [`jose`](https://github.com/panva/jose) (JWT), [`zod`](https://zod.dev/) (validación)
- **Base de datos**: PostgreSQL 16
- **ORM**: Prisma (`backend/prisma/schema.prisma` + migración inicial en `backend/prisma/migrations/`)
- **Contenedores**: Docker + Docker Compose
- **Testing**: Vitest (unit + integración contra Postgres real), Playwright (E2E, configurado vacío), k6 (carga, configurado vacío)

## Estructura del repositorio

```
frontend/            App React (Vite)
backend/
  src/
    modules/          auth, spin, pot, audit — vacíos, TODO V0.3
    db/                migrations/, seeds/
    shared/
    config/            game-rules.ts (valores de J.1-J.3)
  prisma/              schema.prisma (sin migrar)
  tests/
docs/spec/            especificación técnica versionada
infra/
  docker/              Dockerfiles
  ci/
tests/
  e2e/                 Playwright (vacío)
  load/                k6 (vacío)
.github/workflows/    CI (GitHub Actions)
```

## Requisitos (Windows)

- Node.js 20 LTS
- Docker Desktop (con WSL2 backend)
- PowerShell (todos los comandos de abajo asumen PowerShell, no CMD)

## Cómo levantar el proyecto en Windows (PowerShell)

Clonar el repositorio:

```powershell
git clone <URL_DEL_REPO> ruleta-pozo-acumulado
cd ruleta-pozo-acumulado
```

Copiar las variables de entorno de ejemplo:

```powershell
Copy-Item .env.example .env
```

**Este paso es obligatorio antes de cualquier comando de Docker Compose.** Sin un `.env` en la raíz, `docker compose config` (y por tanto `docker compose up`) falla con un error del tipo `env file ...\.env not found`, porque Compose lee `.env` para resolver las variables `${...}` del `docker-compose.yml` (no solo el backend las usa: Postgres también las necesita para `POSTGRES_USER`/`POSTGRES_PASSWORD`).

`.env.example` trae `DB_USER=dev` y `DB_PASSWORD=dev` como valores dummy que ya funcionan para desarrollo local sin tocarlos — **no son para producción**. Desde V0.3, `JWT_SECRET`, `REFRESH_TOKEN_PEPPER` y `EMAIL_TOKEN_PEPPER` **sí** los usa el código (firma de JWT y hash de tokens) y deben tener un valor — cualquier string largo sirve en desarrollo, por ejemplo:

```powershell
$env:JWT_SECRET = "dev-only-secret-cambiar-en-produccion"
$env:REFRESH_TOKEN_PEPPER = "dev-only-pepper-1-cambiar-en-produccion"
$env:EMAIL_TOKEN_PEPPER = "dev-only-pepper-2-cambiar-en-produccion"
```

(o ponlos directamente en tu `.env`). `EMAIL_PROVIDER_KEY` puede seguir vacío: V0.3 no integra un proveedor de email real — en desarrollo, los emails se imprimen a la consola del backend (ver más abajo).

### Opción A — con Docker Compose (recomendado)

```powershell
docker compose up
```

Esto levanta Postgres, el backend (Fastify) y el frontend (Vite) juntos. El backend queda en `http://localhost:3000` y el frontend en `http://localhost:5173`.

### Opción B — backend y frontend por separado (sin Docker)

Backend:

```powershell
cd backend
npm install
npm run dev
```

Frontend (en otra terminal PowerShell):

```powershell
cd frontend
npm install
npm run dev
```

## Verificar que arrancó

```powershell
Invoke-WebRequest http://localhost:3000/health
```

Debe responder `200` con un cuerpo JSON simple. El frontend en `http://localhost:5173` debe mostrar la página "Ruleta con Pozo Acumulado — V0.2 setup".

## Migración y seed de la base de datos (V0.3)

Con Postgres arriba (por Docker Compose o localmente) y las variables de entorno cargadas, en PowerShell:

```powershell
$env:DATABASE_URL = "postgresql://dev:dev@localhost:5432/ruleta_pozo_acumulado"
cd backend
npx prisma migrate dev
npx prisma db seed
```

- `npx prisma migrate dev` aplica la migración inicial (`backend/prisma/migrations/`), que crea las 7 tablas del modelo E de la spec, incluidos los dos índices únicos parciales (`one_open_round`, `one_active_token_per_user`) y los `ON DELETE RESTRICT` en las FKs de historial.
- `npx prisma db seed` (o `npx prisma migrate reset`, que lo corre automáticamente) crea la primera ronda del pozo, con `initial_amount = POT_MINIMUM` (100 por defecto).

Para resetear la base de datos en desarrollo (borra todo y vuelve a migrar + seedear):

```powershell
npx prisma migrate reset
```

**Nota de esta entrega**: la migración inicial (`backend/prisma/migrations/20260918000000_init/migration.sql`) se escribió y verificó a mano contra una Postgres real, **no** se generó con `prisma migrate dev` — el entorno donde se preparó esta entrega no tiene acceso de red a `binaries.prisma.sh` (de donde Prisma descarga el motor de consultas), así que ni `prisma generate` ni `prisma migrate dev` pudieron ejecutarse ahí. El SQL se probó igualmente de forma directa (constraints e índices parciales verificados con inserciones reales), pero **la primera vez que corras `npx prisma migrate dev` en tu máquina, revisa que Prisma no proponga una migración adicional** — si el schema y el SQL escrito a mano no coinciden al 100% en algún detalle menor (nombres de constraint, por ejemplo), Prisma te lo señalará ahí.

## Probar los endpoints de auth (PowerShell)

Con el backend arriba y la base de datos migrada y seedeada:

```powershell
# Registro
$body = @{ email = "tu-email@example.com"; password = "ContraseñaFuerte123!" } | ConvertTo-Json
Invoke-WebRequest -Uri http://localhost:3000/api/auth/register -Method POST -Body $body -ContentType "application/json"
```

El token de verificación se imprime en la consola del backend (JSON con `to`, `subject`, `body` — NODE_ENV=development, ver `src/modules/audit/mailer.ts`). Cópialo del log y úsalo aquí:

```powershell
# Verificación (pega el token que viste en el log del backend)
$body = @{ token = "PEGA_AQUI_EL_TOKEN" } | ConvertTo-Json
Invoke-WebRequest -Uri http://localhost:3000/api/auth/verify -Method POST -Body $body -ContentType "application/json"
```

```powershell
# Login — usa una sesión de PowerShell para conservar las cookies
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$body = @{ email = "tu-email@example.com"; password = "ContraseñaFuerte123!" } | ConvertTo-Json
Invoke-WebRequest -Uri http://localhost:3000/api/auth/login -Method POST -Body $body -ContentType "application/json" -WebSession $session

# Leer el csrfToken de la sesión para las siguientes llamadas
$csrf = ($session.Cookies.GetCookies("http://localhost:3000") | Where-Object { $_.Name -eq "csrfToken" }).Value
```

```powershell
# Refresh (requiere el header X-CSRF-Token)
Invoke-WebRequest -Uri http://localhost:3000/api/auth/refresh -Method POST -WebSession $session -Headers @{ "X-CSRF-Token" = $csrf }
```

```powershell
# Logout
Invoke-WebRequest -Uri http://localhost:3000/api/auth/logout -Method POST -WebSession $session -Headers @{ "X-CSRF-Token" = $csrf }
```

```powershell
# Endpoints públicos, sin sesión
Invoke-WebRequest http://localhost:3000/api/game-info
Invoke-WebRequest http://localhost:3000/api/pot
```

## Pruebas y verificación

```powershell
cd backend
npm run lint
npm run typecheck
npm test
```

`npm test` en `backend` corre tanto los tests unitarios (`tests/*.test.ts` — política de contraseñas, JWT, `game-rules.ts`, sin base de datos) como los de integración (`tests/integration/*.test.ts` — los 5 endpoints de auth, `GET /api/pot`, `GET /api/game-info`, contra una Postgres real). **Los de integración necesitan `DATABASE_URL` apuntando a una base de datos de test** (recomendado: una separada de la de desarrollo, p. ej. `ruleta_pozo_acumulado_test`) y el schema ya migrado:

```powershell
$env:DATABASE_URL = "postgresql://dev:dev@localhost:5432/ruleta_pozo_acumulado_test"
$env:NODE_ENV = "test"
cd backend
npx prisma db push --accept-data-loss   # sincroniza el schema en la BD de test
npm test
```

```powershell
cd ../frontend
npm run lint
npm run typecheck
npm test
```

## Contribuir

Ver [`CONTRIBUTING.md`](./CONTRIBUTING.md) para la convención de commits, ramas y el flujo de PR.

## Changelog

Ver [`CHANGELOG.md`](./CHANGELOG.md).
