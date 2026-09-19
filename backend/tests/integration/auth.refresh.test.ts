import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { setupIntegrationTest } from "./helpers";
import { prisma } from "../../src/lib/prisma";
import { hashPassword } from "../../src/modules/auth/password";

const { app } = setupIntegrationTest();

function getCookie(response: { cookies: Array<{ name: string; value: string }> }, name: string) {
  return response.cookies.find((c) => c.name === name);
}

async function loginAndGetCookies(email: string, password: string) {
  const id = randomUUID();
  await prisma.user.create({
    data: { id, email, passwordHash: await hashPassword(password), emailVerifiedAt: new Date() },
  });

  const loginResponse = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password },
  });

  const refreshToken = getCookie(loginResponse, "refreshToken")!.value;
  const csrfToken = getCookie(loginResponse, "csrfToken")!.value;

  return { userId: id, refreshToken, csrfToken };
}

function cookieHeader(entries: Record<string, string>) {
  return Object.entries(entries)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

describe("POST /api/auth/refresh", () => {
  it("refresh válido rota el token (revoca el anterior, emite uno nuevo)", async () => {
    const { refreshToken, csrfToken } = await loginAndGetCookies("refresh-ok@example.com", "CorrectPassw0rd!23");

    const response = await app.inject({
      method: "POST",
      url: "/api/auth/refresh",
      headers: {
        cookie: cookieHeader({ refreshToken, csrfToken }),
        "x-csrf-token": csrfToken,
      },
    });

    expect(response.statusCode).toBe(200);
    const newRefresh = getCookie(response, "refreshToken");
    expect(newRefresh).toBeDefined();
    expect(newRefresh?.value).not.toBe(refreshToken);

    const oldTokenRows = await prisma.refreshToken.findMany({ where: { revokedAt: { not: null } } });
    expect(oldTokenRows.length).toBeGreaterThanOrEqual(1);
  });

  it("refresh con token ya rotado (reutilización) -> 401 + revoca TODA la familia (resuelve N2)", async () => {
    const { refreshToken, csrfToken } = await loginAndGetCookies("reuse@example.com", "CorrectPassw0rd!23");

    // Primer refresh: rota el token.
    const first = await app.inject({
      method: "POST",
      url: "/api/auth/refresh",
      headers: { cookie: cookieHeader({ refreshToken, csrfToken }), "x-csrf-token": csrfToken },
    });
    expect(first.statusCode).toBe(200);
    const rotatedRefreshToken = getCookie(first, "refreshToken")!.value;

    // Reenviar el token YA ROTADO (reutilización).
    const second = await app.inject({
      method: "POST",
      url: "/api/auth/refresh",
      headers: { cookie: cookieHeader({ refreshToken, csrfToken }), "x-csrf-token": csrfToken },
    });

    expect(second.statusCode).toBe(401);
    expect(second.json().error.code).toBe("invalid_or_revoked_refresh_token");

    // El nuevo token emitido en el primer refresh también debe quedar
    // revocado (toda la familia), no solo el reutilizado.
    const rows = await prisma.refreshToken.findMany();
    expect(rows.every((r) => r.revokedAt !== null)).toBe(true);
    void rotatedRefreshToken;
  });

  it("refresh con cuenta bloqueada -> 423, y NO revoca la familia (resuelve N17)", async () => {
    const { userId, refreshToken, csrfToken } = await loginAndGetCookies(
      "refresh-locked@example.com",
      "CorrectPassw0rd!23"
    );

    await prisma.user.update({ where: { id: userId }, data: { lockedUntil: new Date(Date.now() + 60_000) } });

    const response = await app.inject({
      method: "POST",
      url: "/api/auth/refresh",
      headers: { cookie: cookieHeader({ refreshToken, csrfToken }), "x-csrf-token": csrfToken },
    });

    expect(response.statusCode).toBe(423);
    expect(response.json().error.code).toBe("account_locked");

    // La familia NO debe haberse revocado por este intento bloqueado.
    const rows = await prisma.refreshToken.findMany({ where: { userId } });
    expect(rows.some((r) => r.revokedAt === null)).toBe(true);
  });

  it("caso límite: cuenta bloqueada + refresh token YA revocado -> 423 (no 401), sin revocar de nuevo", async () => {
    const { userId, refreshToken, csrfToken } = await loginAndGetCookies(
      "refresh-locked-reused@example.com",
      "CorrectPassw0rd!23"
    );

    // Revocar el token manualmente (simula reutilización) Y bloquear la cuenta.
    await prisma.refreshToken.updateMany({ where: { userId }, data: { revokedAt: new Date() } });
    await prisma.user.update({ where: { id: userId }, data: { lockedUntil: new Date(Date.now() + 60_000) } });

    const response = await app.inject({
      method: "POST",
      url: "/api/auth/refresh",
      headers: { cookie: cookieHeader({ refreshToken, csrfToken }), "x-csrf-token": csrfToken },
    });

    // Gana el estado de cuenta (423), no la detección de reutilización (401).
    expect(response.statusCode).toBe(423);
    expect(response.json().error.code).toBe("account_locked");
  });

  it("sin X-CSRF-Token -> 403", async () => {
    const { refreshToken, csrfToken } = await loginAndGetCookies("no-csrf@example.com", "CorrectPassw0rd!23");

    const response = await app.inject({
      method: "POST",
      url: "/api/auth/refresh",
      headers: { cookie: cookieHeader({ refreshToken, csrfToken }) },
      // sin header x-csrf-token
    });

    expect(response.statusCode).toBe(403);
  });
});
