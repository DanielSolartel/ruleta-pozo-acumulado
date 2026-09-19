import { randomBytes, createHash, timingSafeEqual } from "node:crypto";

/** 32 bytes aleatorios en hex (64 caracteres) — usado para refreshToken y csrfToken. */
export function generateOpaqueToken(): string {
  return randomBytes(32).toString("hex");
}

function requirePepper(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var ${name} for token hashing`);
  }
  return value;
}

/**
 * SHA-256(token + pepper). Se usa SHA-256 y no Argon2id/bcrypt porque estos
 * tokens son valores aleatorios de alta entropía generados por el servidor,
 * no secretos de baja entropía elegidos por una persona — el hash lento
 * existe para resistir fuerza bruta sobre secretos adivinables, que no es
 * el caso aquí (ver spec E, B2). El pepper añade una capa adicional: un
 * volcado solo de la base de datos no basta para validar tokens robados.
 */
function hashWithPepper(token: string, pepperEnvVar: string): string {
  const pepper = requirePepper(pepperEnvVar);
  return createHash("sha256").update(token).update(pepper).digest("hex");
}

/** Hash de un refreshToken, con REFRESH_TOKEN_PEPPER (ver spec E, B2). */
export function hashRefreshToken(token: string): string {
  return hashWithPepper(token, "REFRESH_TOKEN_PEPPER");
}

/**
 * Hash de un token de verificación de email. Se usa un pepper DISTINTO
 * (EMAIL_TOKEN_PEPPER) al de refresh_tokens (REFRESH_TOKEN_PEPPER) —
 * decisión de esta ronda: son dos clases de secreto con ciclos de vida y
 * radios de exposición distintos (un refresh token vive hasta 30 días y
 * viaja en cada request autenticada; un token de verificación vive 24h y
 * solo se usa una vez). Reutilizar el mismo pepper para ambos acoplaría
 * su rotación sin necesidad: rotar REFRESH_TOKEN_PEPPER (p. ej. tras una
 * fuga) invalidaría también, como efecto secundario no buscado, todos los
 * tokens de verificación de email en vuelo.
 */
export function hashEmailVerificationToken(token: string): string {
  return hashWithPepper(token, "EMAIL_TOKEN_PEPPER");
}

/** Comparación en tiempo constante de dos hashes hex (mismo largo esperado). */
export function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
