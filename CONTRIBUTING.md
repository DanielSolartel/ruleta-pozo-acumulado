# Contribuir

## Convención de commits

[Conventional Commits](https://www.conventionalcommits.org/): `feat`, `fix`, `docs`, `chore`, `test`, `refactor`, `ci`, `build`, `perf`.

Ejemplos:

```
feat(backend): add /health endpoint
docs(spec): close J.1-J.3 for V0.2
chore(repo): scaffold monorepo structure
```

## Ramas

**Trunk-based**: ramas cortas `feat/<nombre>` fusionadas a `main` por Pull Request. No se usa una rama `develop` de larga vida (ver sección N de la spec para la justificación).

## Pull Requests

- No se hace merge a `main` si la CI falla (lint, typecheck, tests).
- Toda PR requiere revisión: el desarrollador la abre; el auditor (DeepSeek) revisa cuando la PR toca áreas sensibles (auth, spin, pot, RNG, seguridad) o cuando corresponde por el roadmap.

## Tags y versiones

Formato `vX.Y.Z`. Cada versión de la especificación se taguea igual que se numera (V0.1 → `v0.1.0`, V0.1.1 → `v0.1.1`, …). A partir de V0.2 (código), el número menor sigue la versión del roadmap (`v0.2.0`, `v0.3.0`…) y el de parche queda para correcciones dentro de esa versión.

## Secretos

Nunca se commitea un `.env` real, una clave JWT, una contraseña de base de datos ni credenciales de proveedor de email. Si se detecta una fuga, la credencial se rota de inmediato y el historial de git se reescribe (`git filter-repo` o BFG).

## Especificación

La especificación técnica vive en [`docs/spec/`](./docs/spec/) y se versiona junto con el código.
