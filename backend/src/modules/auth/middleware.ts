import type { FastifyReply, FastifyRequest } from "fastify";
import { verifyAccessToken } from "./jwt";
import { findUserById } from "./repository";

// Amplía FastifyRequest con el userId resuelto por el middleware de auth,
// para que los handlers no tengan que re-verificar el JWT.
declare module "fastify" {
  interface FastifyRequest {
    userId?: string;
  }
}

/**
 * Middleware de autenticación — orden exacto (resuelve N14):
 *
 *   1. Rate limiting       -> aplicado por ruta vía @fastify/rate-limit,
 *                              registrado como plugin global; su hook
 *                              `onRequest` corre ANTES que los preHandler
 *                              de abajo por el propio ciclo de vida de
 *                              Fastify, así que no hace falta código aquí
 *                              para garantizar el orden — solo que cada
 *                              ruta declare su `config.rateLimit`.
 *   2. CSRF                -> csrfPreHandler (solo en mutaciones sobre
 *                              sesión establecida; register/verify/login
 *                              están exentos, ver spec F).
 *   3. Firma del JWT        -> verifyAccessTokenPreHandler.
 *   4. Estado de cuenta     -> requireActiveAccountPreHandler (logout
 *                              está EXENTO de este paso, resuelve N15).
 *   5. Rol                  -> requireRolePreHandler (hook preparado;
 *                              ninguna ruta de V0.3 lo usa todavía).
 *   6. Handler               -> el handler de la ruta.
 *
 * El orden importa: el rate limiting va primero para que un atacante no
 * pueda agotar los cubos de límite forzando primero la autenticación; el
 * CSRF va antes de validar la firma del JWT para no filtrar, a un atacante
 * sin csrfToken válido, si su JWT robado o falsificado es o no válido; el
 * estado de cuenta y el rol se validan después de que la firma ya es de
 * confianza, porque dependen de leer datos asociados a un user_id que solo
 * es fiable una vez verificada la firma.
 */

export class HttpError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message?: string
  ) {
    super(message ?? code);
  }
}

/**
 * Paso 2 — CSRF (double-submit): el header X-CSRF-Token debe coincidir con
 * la cookie csrfToken. Se usa en toda mutación sobre sesión establecida
 * (refresh, logout); register/verify/login están exentos porque no hay
 * sesión previa contra la que comparar (ver spec F, M3).
 */
export async function csrfPreHandler(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const cookieToken = request.cookies?.csrfToken;
  const headerToken = request.headers["x-csrf-token"];

  if (!cookieToken || typeof headerToken !== "string" || headerToken !== cookieToken) {
    throw new HttpError(403, "csrf_token_invalid");
  }
}

/**
 * Paso 3 — firma del JWT. Lee accessToken de la cookie, verifica contra
 * JWT_SECRET (y JWT_SECRET_PREVIOUS en ventana de rotación, ver jwt.ts).
 * Si es válido, adjunta request.userId. Si no, 401.
 */
export async function verifyAccessTokenPreHandler(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  const token = request.cookies?.accessToken;
  if (!token) {
    throw new HttpError(401, "unauthorized");
  }

  const result = await verifyAccessToken(token);
  if (!result.valid) {
    throw new HttpError(401, "unauthorized");
  }

  request.userId = result.userId;
}

/**
 * Paso 4 — estado de cuenta: locked_until no en el futuro, email_verified_at
 * no nulo. Requiere que verifyAccessTokenPreHandler ya haya corrido (usa
 * request.userId). Logout NO usa este preHandler (resuelve N15).
 */
export async function requireActiveAccountPreHandler(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  if (!request.userId) {
    // No debería ocurrir si el orden de preHandlers es correcto, pero se
    // guarda por seguridad en vez de asumir.
    throw new HttpError(401, "unauthorized");
  }

  const user = await findUserById(request.userId);
  if (!user) {
    throw new HttpError(401, "unauthorized");
  }

  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    throw new HttpError(423, "account_locked");
  }

  if (!user.emailVerifiedAt) {
    throw new HttpError(403, "email_not_verified");
  }
}

/**
 * Paso 5 — rol: hook preparado, sin uso en V0.3 (ninguna ruta lo exige
 * todavía; se deja listo para GET /api/admin/... en una ronda futura).
 */
export function requireRolePreHandler(requiredRole: string) {
  return async function roleCheck(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    if (!request.userId) {
      throw new HttpError(401, "unauthorized");
    }
    const user = await findUserById(request.userId);
    if (!user || user.role !== requiredRole) {
      throw new HttpError(403, "forbidden");
    }
  };
}
