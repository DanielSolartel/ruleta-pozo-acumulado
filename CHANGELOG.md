# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/). Versionado según [Convención de tags](./CONTRIBUTING.md#tags-y-versiones).

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
