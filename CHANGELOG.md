# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/). Versionado según [Convención de tags](./CONTRIBUTING.md#tags-y-versiones).

## [v0.2.1] - 2026-09-17

Correcciones puntuales encontradas en verificación en máquina real (Windows) por DeepSeek, antes de empezar V0.3. Sin lógica de negocio nueva.

### Fixed

- **`backend/src/app.ts`** (A4, alto): el guard `if (import.meta.url === ...)` que decide si arrancar el servidor comparaba strings construidos a mano y no funcionaba en Windows (separadores `\`, mayúsculas de unidad) — `npm run dev` no arrancaba nada ahí. Reemplazado por `pathToFileURL(process.argv[1]).href`, que normaliza igual que Node.
- **`@typescript-eslint/eslint-plugin` y `@typescript-eslint/parser`** en `backend` y `frontend` (A9, alto): actualizados de 7.x a 8.x para soportar TypeScript 5.9.x (el `^5.5.4` declarado instalaba 5.9.3, fuera del rango soportado por la 7.x del plugin, y `npm run lint` emitía un warning de versión no soportada en ambos workspaces).
- **`backend/prisma/schema.prisma`** (A1, medio): `PotRound.winnerSpinId` no tenía `@relation` declarada — no había FK real a `spins` pese a que la spec la exige. Añadida la relación `winnerSpin` (y su lado inverso `roundWon` en `Spin`), con nombres explícitos (`RoundSpins`, `RoundWinnerSpin`) porque ahora hay dos relaciones distintas entre `PotRound` y `Spin`.
- **`backend/src/config/game-rules.ts`** (A2/A3, medio): sin validación de positividad. Añadidas `parsePositiveIntEnv` (para `GOLD_PROBABILITY_DENOMINATOR`, que no admite 0 ni negativos) y `parseNonNegativeIntEnv` (para `POT_MINIMUM` y `CONTRIBUTION_AMOUNT`, que admiten 0 pero no negativos).
- **`docker-compose.yml`** (A15, bajo): `env_file: .env` en los tres servicios propagaba secretos (`JWT_SECRET`, `DB_PASSWORD`, `REFRESH_TOKEN_PEPPER`...) al contenedor `frontend`, que no los usa. Sustituido por `environment:` explícito por servicio — el backend solo recibe las variables de `game-rules.ts` más `NODE_ENV`/`PORT`; el frontend no recibe ninguna.
- **`.env.example`** (A14, medio): `DB_USER`/`DB_PASSWORD` vacíos hacían que Postgres no arrancara y el healthcheck (`pg_isready -U` sin usuario) nunca pasara, colgando `docker compose up`. Ahora `DB_USER=dev`/`DB_PASSWORD=dev` (dummies de desarrollo, comentados como tales).
- **`.gitignore`** (A8, bajo): eliminada la línea `node_modules/` duplicada.

### Added

- **`backend/tests/app.test.ts`** (A4): prueba `GET /health` con `app.inject(...)`, sin arrancar el servidor real, para que la suite cubra el handler independientemente del guard de arranque.
- **`.env.example`**: `PORT=3000` (A6) y `DATABASE_URL` de ejemplo, comentada como pendiente de uso real en V0.3 (A7).
- **`README.md`** (A12): paso explícito `Copy-Item .env.example .env` antes de cualquier comando de Docker Compose, y nota sobre los valores dummy de `DB_USER`/`DB_PASSWORD`.
- **`docs/spec/especificacion-tecnica.md`**: nueva subsección `L.9 Auditoría V0.2.1` con el detalle de A1–A15; fila `V0.2.1` en H.

### Known issues (documentado, no corregido en esta ronda)

- **A10**: `npm audit` reporta 7 vulnerabilidades en `backend` y 5 en `frontend` (mayoría en dependencias de desarrollo: ESLint 8.x deprecado, `glob@7`, `rimraf@3`). No se corrigen aquí para no romper nada sin red de pruebas de por medio — la spec (sección N, roadmap H) ya prevé añadir escaneo de dependencias al CI a partir de V0.7, que es cuando se abordarán de forma sistemática.

## [v0.2.0] - 2026-09-17

### Added

- Estructura inicial del monorepo (`frontend/`, `backend/`, `docs/spec/`, `infra/`, `tests/`, `.github/workflows/`), según la sección N de la especificación.
- Esqueleto de backend (Fastify + TypeScript): módulos `auth`, `spin`, `pot`, `audit` vacíos (`TODO V0.3`), `src/app.ts` con endpoint `GET /health`, `src/config/game-rules.ts` con las constantes cerradas en J.1-J.3.
- Esqueleto de frontend (React + TypeScript + Vite): página de inicio vacía.
- Schema inicial de Prisma reflejando el modelo E de la spec (`users`, `pot_rounds`, `spins`, `pot_wins`, `idempotency_keys`, `refresh_tokens`, `email_verification_tokens`), con sus constraints e índices. **No migrado todavía** contra ninguna base de datos.
- `docker-compose.yml` con servicios `postgres`, `backend`, `frontend`.
- CI mínima en GitHub Actions (`.github/workflows/ci.yml`): lint, typecheck, test (Vitest en vacío), Postgres como servicio.
- Archivos de raíz obligatorios: `README.md`, `LICENSE` (MIT), `.gitignore`, `.env.example`, `.editorconfig`, `CONTRIBUTING.md`.
- Especificación técnica actualizada a V0.2 en `docs/spec/`: J.1, J.2 y J.3 cerradas con los valores decididos por el product owner (`pot_minimum = 100`, `contribution_amount = 1`, `p = 1/100.000`).

### Notes

- Sin lógica de negocio real todavía (auth, spins, RNG, pozo) — eso es V0.3+.
- `docker compose up` no se pudo verificar en este entorno de entrega (sin daemon de Docker disponible); ver el resumen de entrega para el detalle de qué se verificó y qué no.
