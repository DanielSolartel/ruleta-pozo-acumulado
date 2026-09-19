# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/). Versionado según [Convención de tags](./CONTRIBUTING.md#tags-y-versiones).

## [v0.3.0] - 2026-09-19

Primera entrega con lógica de negocio real: autenticación completa y endpoints públicos de información del juego. `POST /api/spins` (el giro, con RNG y transacción SERIALIZABLE) queda deliberadamente fuera de esta entrega — ver la nota de divergencia de alcance más abajo.

### Divergencia de alcance respecto al roadmap (sección H de la spec)

La spec agrupaba auth + endpoint de giro en una sola V0.3. Por recomendación de DeepSeek, se divide en dos entregas auditables:

- **V0.3 (esta)**: migración inicial de Prisma, módulo de auth completo (5 endpoints), `GET /api/game-info`, `GET /api/pot`, seed de la primera ronda.
- **V0.3.1 (próxima)**: `POST /api/spins` con RNG, transacción SERIALIZABLE, idempotencia, cierre/apertura de ronda.

Justificación: auth (sesiones, cookies, CSRF) y spin (transacción, RNG, concurrencia) son dos superficies de ataque muy distintas; auditarlas juntas en una sola ronda habría sido impracticable con la profundidad que exige la spec (G, I). Documentado también en H (nota al pie) y en `docs/spec/especificacion-tecnica.md`, L.10.

### Added

- **Migración inicial de Prisma** (`backend/prisma/migrations/20260918000000_init/`): las 7 tablas del modelo E, con `UNIQUE(user_id, game_day)`, `UNIQUE(winner_spin_id)`, los índices únicos parciales `one_open_round` y `one_active_token_per_user`, y `ON DELETE RESTRICT` en todas las FKs de historial.
- **`backend/prisma/seed.ts`**: crea la primera ronda activa (`initial_amount = POT_MINIMUM`), idempotente.
- **Módulo de auth** (`backend/src/modules/auth/`): `password.ts` (política + Argon2id, parámetros OWASP 2024), `jwt.ts` (HS256 vía `jose`, con ventana de rotación `JWT_SECRET_PREVIOUS`), `tokens.ts` (tokens opacos + hash con pepper, peppers distintos para refresh y verificación de email), `schemas.ts` (validación Zod), `middleware.ts` (orden N14/N15), `rateLimitByKey.ts` (limitador secundario en memoria por email/cuenta, complementario a `@fastify/rate-limit`), `repository.ts` (acceso a datos vía Prisma), `routes.ts` (los 5 endpoints: register, verify, login, refresh, logout).
- **`backend/src/modules/audit/mailer.ts`**: mailer de desarrollo — imprime a stdout en `NODE_ENV=development`, lanza error explícito fuera de development. Sin proveedor de email real (decisión explícita de esta ronda).
- **`backend/src/modules/pot/routes.ts`**: `GET /api/game-info` (público, sin DB) y `GET /api/pot` (público, ronda activa + `currentAmount`).
- **Tests unitarios**: `password.test.ts` (13), `jwt.test.ts` (7) — verificados pasando de verdad.
- **Tests de integración** (`backend/tests/integration/`): los 5 endpoints de auth, `pot.test.ts`, `game-info.test.ts`, usando `app.inject()` contra una Postgres real (ver decisión sobre testcontainers más abajo).
- **`.env.example`**: `DATABASE_URL`, `EMAIL_TOKEN_PEPPER` añadidos.
- **CI**: el job `typecheck` genera el cliente Prisma antes de tipar (solo backend); el job `test` genera el cliente y aplica `prisma migrate deploy` contra el servicio Postgres antes de correr los tests.

### Fixed durante el desarrollo (hallazgos propios, no de auditoría externa)

- **Reinicio de `failed_login_attempts` al expirar `locked_until`**: la implementación inicial solo reiniciaba el contador tras un login exitoso: un intento con contraseña incorrecta justo después de que expirara un bloqueo incrementaba desde el contador viejo (5→6) y volvía a bloquear la cuenta de inmediato con un solo intento. Corregido para reiniciar el contador en cuanto se detecta `locked_until` vencido, antes de evaluar la contraseña de ese intento (cumple el requisito (b) de la spec).
- **`@prisma/client` en v7 mientras el CLI `prisma` está fijado en `^5.19.1`**: `npm install @prisma/client` sin versión explícita instaló la última (7.x). Fijado a `^5.19.1` para que coincidan.

### Decisiones de esta ronda

- **Testcontainers no se usa** (la spec ofrecía elegir entre testcontainers o el servicio Postgres de docker-compose/CI con una base separada): testcontainers requiere Docker, no disponible en el entorno donde se preparó esta entrega. Se usa la alternativa explícitamente autorizada por la spec: una base `ruleta_pozo_acumulado_test` separada, vía `DATABASE_URL`.
- **`EMAIL_TOKEN_PEPPER` distinto de `REFRESH_TOKEN_PEPPER`**: son dos clases de secreto con ciclos de vida distintos (30 días viajando en cada request vs. 24h de un solo uso); reutilizar el mismo pepper acoplaría su rotación sin necesidad.
- **Rate limiting secundario (por email/cuenta) implementado a mano** (`rateLimitByKey.ts`), en memoria, sin dependencia nueva: `@fastify/rate-limit` no soporta directamente dos límites independientes (IP + email) sobre la misma ruta. Limitación conocida: no sirve para múltiples instancias del backend sin moverlo a un store compartido — documentado, no una omisión.

### Known issues / no verificado en esta entrega

- **`prisma generate` / `prisma validate` / `prisma migrate dev` no pudieron ejecutarse** en el entorno donde se preparó esta entrega: `binaries.prisma.sh` (de donde Prisma descarga su motor de consultas) no es alcanzable ahí. La migración inicial se escribió a mano y se verificó con SQL directo contra una Postgres real (constraints e índices parciales probados con inserciones reales), pero **no** es el output literal de `prisma migrate dev` — revisar al correrlo por primera vez en un entorno con red completa.
- Como consecuencia de lo anterior, **los tests de integración no pudieron ejecutarse de principio a fin** en esa misma entrega (`@prisma/client` no se generó, por lo que `PrismaClient` no se puede instanciar) — sí se ejecutaron los unitarios (`password.test.ts`, `jwt.test.ts`, 20/20 pasando).
- Tiempo real del bloqueo de 15 minutos tras 5 intentos fallidos: no verificado en tiempo real (se probó la lógica de umbral y de expiración vía manipulación directa de `locked_until` en los tests, no esperando 15 minutos de reloj).
- Vulnerabilidades de dependencias (A10, heredado de v0.2.1): sigue documentado como pendiente para V0.7.

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
