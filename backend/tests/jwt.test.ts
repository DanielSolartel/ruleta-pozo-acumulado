import { SignJWT } from "jose";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { signAccessToken, verifyAccessToken } from "../src/modules/auth/jwt";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.JWT_SECRET = "test-current-secret";
  delete process.env.JWT_SECRET_PREVIOUS;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("signAccessToken / verifyAccessToken", () => {
  it("firma y verifica un token válido, devolviendo el userId correcto", async () => {
    const token = await signAccessToken("user-abc-123");
    const result = await verifyAccessToken(token);
    expect(result).toEqual({ valid: true, userId: "user-abc-123" });
  });

  it("rechaza un string que no es un JWT", async () => {
    const result = await verifyAccessToken("esto-no-es-un-jwt");
    expect(result).toEqual({ valid: false, reason: "invalid" });
  });

  it("rechaza un token expirado con reason: 'expired'", async () => {
    const expired = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-exp")
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 1)
      .sign(new TextEncoder().encode("test-current-secret"));

    const result = await verifyAccessToken(expired);
    expect(result).toEqual({ valid: false, reason: "expired" });
  });

  it("rechaza un token firmado con una clave que no es JWT_SECRET ni JWT_SECRET_PREVIOUS", async () => {
    const wrongKey = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-wrong")
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(new TextEncoder().encode("totally-different-secret"));

    const result = await verifyAccessToken(wrongKey);
    expect(result).toEqual({ valid: false, reason: "invalid" });
  });

  it("acepta un token firmado con JWT_SECRET_PREVIOUS (ventana de rotación, resuelve N10)", async () => {
    process.env.JWT_SECRET_PREVIOUS = "test-old-secret";
    const oldToken = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-old")
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(new TextEncoder().encode("test-old-secret"));

    const result = await verifyAccessToken(oldToken);
    expect(result).toEqual({ valid: true, userId: "user-old" });
  });

  it("prioriza JWT_SECRET sobre JWT_SECRET_PREVIOUS cuando ambas están definidas", async () => {
    process.env.JWT_SECRET_PREVIOUS = "test-old-secret";
    const currentToken = await signAccessToken("user-current");
    const result = await verifyAccessToken(currentToken);
    expect(result).toEqual({ valid: true, userId: "user-current" });
  });

  it("no acepta un token firmado con JWT_SECRET_PREVIOUS si esta variable no está definida", async () => {
    // JWT_SECRET_PREVIOUS no está seteada (fuera de la ventana de rotación)
    const tokenWithOtherKey = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-x")
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(new TextEncoder().encode("some-old-key-not-configured"));

    const result = await verifyAccessToken(tokenWithOtherKey);
    expect(result.valid).toBe(false);
  });
});
