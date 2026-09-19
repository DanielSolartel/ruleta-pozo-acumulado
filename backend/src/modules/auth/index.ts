// Módulo "auth" — implementado en V0.3 (ver routes.ts, middleware.ts,
// password.ts, jwt.ts, tokens.ts, schemas.ts, repository.ts,
// rateLimitByKey.ts). Este archivo re-exporta lo que otros módulos del
// backend necesitan consumir (p. ej. el error handler global en app.ts).
export { registerAuthRoutes } from "./routes";
export { HttpError } from "./middleware";
