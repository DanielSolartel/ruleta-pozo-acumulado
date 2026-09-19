import { SignJWT, jwtVerify, errors as joseErrors } from "jose";

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60; // 15 min (ver spec F, login)
const ALG = "HS256";

function requireSecret(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var ${name} for JWT signing/verification`);
  }
  return value;
}

function encodedSecret(name: string): Uint8Array {
  return new TextEncoder().encode(requireSecret(name));
}

export interface AccessTokenClaims {
  sub: string; // userId
  iat: number;
  exp: number;
}

/** Firma un accessToken JWT HS256 con claims { sub, iat, exp } (TTL 15 min). */
export async function signAccessToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: ALG })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(encodedSecret("JWT_SECRET"));
}

export type VerifyAccessTokenResult =
  | { valid: true; userId: string }
  | { valid: false; reason: "expired" | "invalid" };

/**
 * Verifica un accessToken: intenta con JWT_SECRET; si falla (firma
 * inválida, no expiración), reintenta con JWT_SECRET_PREVIOUS si está
 * definida (ventana de rotación, ver spec C/N10/N14). Si ambas fallan,
 * { valid: false }.
 */
export async function verifyAccessToken(token: string): Promise<VerifyAccessTokenResult> {
  const secretsToTry = [encodedSecret("JWT_SECRET")];
  const previous = process.env.JWT_SECRET_PREVIOUS;
  if (previous) secretsToTry.push(new TextEncoder().encode(previous));

  let lastWasExpired = false;

  for (const secret of secretsToTry) {
    try {
      const { payload } = await jwtVerify(token, secret, { algorithms: [ALG] });
      if (typeof payload.sub !== "string") {
        return { valid: false, reason: "invalid" };
      }
      return { valid: true, userId: payload.sub };
    } catch (err) {
      if (err instanceof joseErrors.JWTExpired) {
        lastWasExpired = true;
      }
      // Firma inválida contra esta clave: probar la siguiente.
    }
  }

  return { valid: false, reason: lastWasExpired ? "expired" : "invalid" };
}
