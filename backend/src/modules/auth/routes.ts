import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  checkPasswordPolicy,
  getDummyPasswordHash,
  hashPassword,
  verifyPassword,
} from "./password";
import { registerSchema, verifySchema, loginSchema, zodIssuesToDetails } from "./schemas";
import {
  generateOpaqueToken,
  hashEmailVerificationToken,
  hashRefreshToken,
} from "./tokens";
import { signAccessToken } from "./jwt";
import {
  createEmailVerificationToken,
  createRefreshToken,
  createUser,
  findEmailVerificationTokenByHash,
  findRefreshTokenByHash,
  findUserByEmail,
  findUserById,
  consumeEmailVerificationToken,
  recordFailedLogin,
  resetFailedLoginAttempts,
  revokeAllRefreshTokensForUser,
  revokeRefreshToken,
} from "./repository";
import { csrfPreHandler, verifyAccessTokenPreHandler } from "./middleware";
import { getMailer } from "../audit/mailer";
import { checkRateLimitByKey } from "./rateLimitByKey";

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 días
const LOGIN_LOCKOUT_THRESHOLD = 5;

const isProd = () => process.env.NODE_ENV === "production";

function setSessionCookies(
  reply: FastifyReply,
  cookies: { accessToken: string; refreshToken: string; csrfToken: string }
): void {
  const secure = isProd();

  reply.setCookie("accessToken", cookies.accessToken, {
    httpOnly: true,
    secure,
    sameSite: "strict",
    path: "/",
    maxAge: 15 * 60,
  });
  reply.setCookie("refreshToken", cookies.refreshToken, {
    httpOnly: true,
    secure,
    sameSite: "strict",
    path: "/api/auth/refresh",
    maxAge: REFRESH_TOKEN_TTL_MS / 1000,
  });
  reply.setCookie("csrfToken", cookies.csrfToken, {
    httpOnly: false,
    secure,
    sameSite: "strict",
    path: "/",
    maxAge: REFRESH_TOKEN_TTL_MS / 1000,
  });
}

function clearSessionCookies(reply: FastifyReply): void {
  reply.clearCookie("accessToken", { path: "/" });
  reply.clearCookie("refreshToken", { path: "/api/auth/refresh" });
  reply.clearCookie("csrfToken", { path: "/" });
}

async function issueNewSession(userId: string): Promise<{
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
}> {
  const accessToken = await signAccessToken(userId);
  const refreshToken = generateOpaqueToken();
  const csrfToken = generateOpaqueToken();

  await createRefreshToken({
    id: randomUUID(),
    userId,
    tokenHash: hashRefreshToken(refreshToken),
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
  });

  return { accessToken, refreshToken, csrfToken };
}

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /api/auth/register ────────────────────────────────────────────
  app.post(
    "/api/auth/register",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = registerSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(422).send({
          error: { code: "weak_password", message: "invalid request body", details: zodIssuesToDetails(parsed.error) },
        });
      }

      const { email, password } = parsed.data;

      const policy = checkPasswordPolicy(password);
      if (!policy.valid) {
        return reply.code(422).send({
          error: {
            code: "weak_password",
            message: "password does not meet the policy",
            details: policy.issues.map((issue) => ({ field: "password", issue })),
          },
        });
      }

      const existing = await findUserByEmail(email);

      if (existing) {
        // No enumeración de cuentas (resuelve N5): no se crea nada nuevo,
        // se envía un email distinto, y la respuesta tiene la MISMA forma
        // que el caso de éxito, con un userId que no referencia a nadie.
        await getMailer().send({
          to: email,
          subject: "Ya tienes una cuenta en Ruleta con Pozo Acumulado",
          body: "Alguien intentó registrar esta dirección de nuevo. Si fuiste tú y olvidaste tu contraseña, contacta soporte (el flujo de recuperación llega en una versión futura).",
        });
        return reply.code(201).send({ userId: randomUUID() });
      }

      const userId = randomUUID();
      const passwordHash = await hashPassword(password);
      await createUser({ id: userId, email, passwordHash });

      const verificationToken = generateOpaqueToken();
      await createEmailVerificationToken({
        id: randomUUID(),
        userId,
        tokenHash: hashEmailVerificationToken(verificationToken),
        expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
      });

      await getMailer().send({
        to: email,
        subject: "Verifica tu cuenta — Ruleta con Pozo Acumulado",
        body: `Tu token de verificación es: ${verificationToken} (expira en 24h). Úsalo en POST /api/auth/verify.`,
      });

      return reply.code(201).send({ userId });
    }
  );

  // ── POST /api/auth/verify ──────────────────────────────────────────────
  app.post(
    "/api/auth/verify",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = verifySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(404).send({ error: { code: "token_invalid", message: "invalid request body" } });
      }

      const tokenHash = hashEmailVerificationToken(parsed.data.token);
      const row = await findEmailVerificationTokenByHash(tokenHash);

      if (!row) {
        return reply.code(404).send({ error: { code: "token_invalid", message: "token not found" } });
      }

      // Límite secundario por cuenta (5/min), ahora que conocemos el
      // user_id asociado al token (ver spec F, B3).
      if (!checkRateLimitByKey(`verify:${row.userId}`, { max: 5, windowMs: 60_000 })) {
        return reply.code(429).send({ error: { code: "too_many_requests", message: "rate limit exceeded" } });
      }

      if (row.usedAt !== null) {
        return reply.code(404).send({ error: { code: "token_invalid", message: "token already used" } });
      }

      if (row.expiresAt.getTime() <= Date.now()) {
        return reply.code(410).send({ error: { code: "token_expired", message: "token expired" } });
      }

      await consumeEmailVerificationToken(row.id, row.userId);

      return reply.code(200).send({ verified: true });
    }
  );

  // ── POST /api/auth/login ───────────────────────────────────────────────
  app.post(
    "/api/auth/login",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = loginSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(401).send({ error: { code: "invalid_credentials", message: "invalid request body" } });
      }
      const { email, password } = parsed.data;

      if (!checkRateLimitByKey(`login:${email}`, { max: 5, windowMs: 60_000 })) {
        return reply.code(429).send({ error: { code: "too_many_requests", message: "rate limit exceeded" } });
      }

      const user = await findUserByEmail(email);

      if (!user) {
        // Gasta el mismo tiempo aproximado que una verificación real, para
        // no filtrar existencia de cuenta por temporización.
        await verifyPassword(await getDummyPasswordHash(), password);
        return reply.code(401).send({ error: { code: "invalid_credentials", message: "invalid email or password" } });
      }

      if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
        return reply.code(423).send({ error: { code: "account_locked", message: "account is locked" } });
      }

      // (b) locked_until ya pasó (o nunca se seteó): si había un contador
      // de intentos fallidos pendiente de un bloqueo ya vencido, se
      // reinicia a 0 AQUÍ, antes de evaluar la contraseña de este
      // intento — no solo tras un login exitoso (a). Sin esto, un
      // intento con password incorrecta justo después de que expire el
      // bloqueo incrementaría desde el contador viejo (p. ej. 5→6) y
      // volvería a bloquear la cuenta de inmediato con un solo intento.
      let failedAttempts = user.failedLoginAttempts;
      if (user.lockedUntil && user.lockedUntil.getTime() <= Date.now()) {
        await resetFailedLoginAttempts(user.id);
        failedAttempts = 0;
      }

      const passwordOk = await verifyPassword(user.passwordHash, password);

      if (!passwordOk) {
        const newCount = failedAttempts + 1;
        await recordFailedLogin(user.id, newCount);
        const nowLocked = newCount >= LOGIN_LOCKOUT_THRESHOLD;
        return reply
          .code(nowLocked ? 423 : 401)
          .send({
            error: {
              code: nowLocked ? "account_locked" : "invalid_credentials",
              message: nowLocked ? "account is locked" : "invalid email or password",
            },
          });
      }

      if (!user.emailVerifiedAt) {
        // Credenciales correctas pero cuenta no verificada: no es un fallo
        // de contraseña (no cuenta para el contador de bloqueo) ni un
        // login completo (no rota cookies) — un tercer estado explícito,
        // documentado aquí porque la spec no lo desambiguaba del todo.
        return reply.code(403).send({ error: { code: "email_not_verified", message: "email not verified" } });
      }

      await resetFailedLoginAttempts(user.id);
      const session = await issueNewSession(user.id);
      setSessionCookies(reply, session);

      return reply.code(200).send();
    }
  );

  // ── POST /api/auth/refresh ─────────────────────────────────────────────
  app.post(
    "/api/auth/refresh",
    {
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
      preHandler: [csrfPreHandler],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const refreshToken = request.cookies?.refreshToken;
      if (!refreshToken) {
        return reply.code(401).send({ error: { code: "invalid_or_revoked_refresh_token", message: "missing refresh token" } });
      }

      const tokenHash = hashRefreshToken(refreshToken);
      const row = await findRefreshTokenByHash(tokenHash);

      if (!row) {
        return reply.code(401).send({ error: { code: "invalid_or_revoked_refresh_token", message: "unknown refresh token" } });
      }

      if (!checkRateLimitByKey(`refresh:${row.userId}`, { max: 10, windowMs: 60_000 })) {
        return reply.code(429).send({ error: { code: "too_many_requests", message: "rate limit exceeded" } });
      }

      // PASO 1 (resuelve N17): estado de cuenta ANTES que reutilización —
      // una cuenta bloqueada no debe disparar la revocación de familia.
      const user = await findUserById(row.userId);
      if (!user) {
        return reply.code(401).send({ error: { code: "invalid_or_revoked_refresh_token", message: "user not found" } });
      }
      if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
        return reply.code(423).send({ error: { code: "account_locked", message: "account is locked" } });
      }
      if (!user.emailVerifiedAt) {
        return reply.code(403).send({ error: { code: "email_not_verified", message: "email not verified" } });
      }

      // PASO 2: reutilización.
      if (row.revokedAt !== null) {
        await revokeAllRefreshTokensForUser(row.userId);
        request.log.warn({ result: "refresh_reuse_detected", userId: row.userId }, "refresh token reuse detected");
        return reply.code(401).send({ error: { code: "invalid_or_revoked_refresh_token", message: "token already rotated" } });
      }

      if (row.expiresAt.getTime() <= Date.now()) {
        return reply.code(401).send({ error: { code: "invalid_or_revoked_refresh_token", message: "token expired" } });
      }

      // PASO 3: rotación.
      await revokeRefreshToken(row.id);
      const session = await issueNewSession(user.id);
      setSessionCookies(reply, session);

      return reply.code(200).send();
    }
  );

  // ── POST /api/auth/logout ──────────────────────────────────────────────
  app.post(
    "/api/auth/logout",
    {
      // Exento de requireActiveAccountPreHandler (resuelve N15): una
      // cuenta bloqueada o no verificada puede cerrar sesión igual.
      preHandler: [csrfPreHandler, verifyAccessTokenPreHandler],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const refreshToken = request.cookies?.refreshToken;
      if (refreshToken) {
        const row = await findRefreshTokenByHash(hashRefreshToken(refreshToken));
        if (row && row.revokedAt === null) {
          await revokeRefreshToken(row.id);
        }
      }

      clearSessionCookies(reply);
      return reply.code(204).send();
    }
  );

}
