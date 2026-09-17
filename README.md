# Ruleta con Pozo Acumulado

Juego de casino virtual con un pozo acumulado compartido. **Sin dinero real** en esta etapa (V0.x): el premio es virtual.

Especificación técnica completa (V0.1 a V0.2, con historial de auditoría): [`docs/spec/`](./docs/spec/).

## Estado del proyecto

**V0.2** — arranque del repositorio. Esta versión contiene solo el esqueleto: estructura de carpetas, configuración, un endpoint `/health` en el backend y una página vacía en el frontend. **No hay lógica de negocio real todavía** (login, giros, RNG, pozo) — eso empieza en V0.3, según el roadmap de la sección H de la spec.

## Stack

- **Frontend**: React + TypeScript + Vite
- **Backend**: Node.js + TypeScript + Fastify
- **Base de datos**: PostgreSQL 16
- **ORM**: Prisma (schema listo en `backend/prisma/schema.prisma`; **no migrado todavía** contra ninguna base de datos)
- **Contenedores**: Docker + Docker Compose
- **Testing**: Vitest (unit/integración), Playwright (E2E, configurado vacío), k6 (carga, configurado vacío)

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

Copiar las variables de entorno de ejemplo y completar los secretos localmente (nunca commitear el `.env` real):

```powershell
Copy-Item .env.example .env
```

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

## Pruebas y verificación

```powershell
cd backend
npm run lint
npm run typecheck
npm test

cd ../frontend
npm run lint
npm run typecheck
npm test
```

En V0.2 los tests están configurados pero vacíos (deben pasar en 0 tests, no fallar).

## Contribuir

Ver [`CONTRIBUTING.md`](./CONTRIBUTING.md) para la convención de commits, ramas y el flujo de PR.

## Changelog

Ver [`CHANGELOG.md`](./CHANGELOG.md).
