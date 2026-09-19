import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { setupIntegrationTest } from "./helpers";
import { prisma } from "../../src/lib/prisma";
import { hashPassword } from "../../src/modules/auth/password";

const { app } = setupIntegrationTest();

function getCookie(response: { cookies: Array<{ name: string; value: string }> }, name: string) {
  return response.cookies.find((c) => c.name === name);
}
function cookieHeader(entries: Record<string, string>) {
  return Object.entries(entries)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

async function loginAndGetCookies(email: string, password: string, verified = true) {
  const id = randomUUID();
  await prisma.user.create({
    data: {
      id,
      email,
      passwordHash: await hashPassword(password),
      emailVerifiedAt: verified ? new Date() : null,
    },
  });
  const loginResponse = await app.inject({ method: "POST", url: "/api/auth/login", payload: { email, password } });
  return {
    userId: id,
    accessToken: getCookie(loginResponse, "accessToken")?.value,
    refreshToken: getCookie(loginResponse, "refreshToken")?.value,
    csrfToken: getCookie(loginResponse, "csrfToken")?.value,
  };
}

describe("POST /api/auth/logout", () => {
  it("logout exitoso -> 204 + cookies limpias, revoca el refresh token", async () => {
    const { userId, accessToken, refreshToken, csrfToken } = await loginAndGetCookies(
      "logout-ok@example.com",
      "CorrectPassw0rd!23"
    );

    const response = await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      headers: {
        cookie: cookieHeader({ accessToken: accessToken!, refreshToken: refreshToken!, csrfToken: csrfToken! }),
        "x-csrf-token": csrfToken!,
      },
    });

    expect(response.statusCode).toBe(204);

    const cleared = getCookie(response, "accessToken");
    expect(cleared?.value === "" || cleared?.expires !== undefined).toBeTruthy();

    const tokenRow = await prisma.refreshToken.findFirst({ where: { userId } });
    expect(tokenRow?.revokedAt).not.toBeNull();
  });

  it("logout con cuenta bloqueada -> 204 igual (exento de estado de cuenta, resuelve N15)", async () => {
    const { userId, accessToken, refreshToken, csrfToken } = await loginAndGetCookies(
      "logout-locked@example.com",
      "CorrectPassw0rd!23"
    );

    await prisma.user.update({ where: { id: userId }, data: { lockedUntil: new Date(Date.now() + 60_000) } });

    const response = await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      headers: {
        cookie: cookieHeader({ accessToken: accessToken!, refreshToken: refreshToken!, csrfToken: csrfToken! }),
        "x-csrf-token": csrfToken!,
      },
    });

    expect(response.statusCode).toBe(204);
  });

  it("sin X-CSRF-Token -> 403, no revoca nada", async () => {
    const { userId, accessToken, refreshToken, csrfToken } = await loginAndGetCookies(
      "logout-no-csrf@example.com",
      "CorrectPassw0rd!23"
    );

    const response = await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      headers: { cookie: cookieHeader({ accessToken: accessToken!, refreshToken: refreshToken!, csrfToken: csrfToken! }) },
    });

    expect(response.statusCode).toBe(403);
    const tokenRow = await prisma.refreshToken.findFirst({ where: { userId } });
    expect(tokenRow?.revokedAt).toBeNull();
  });

  it("sin accessToken válido -> 401", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      headers: { cookie: cookieHeader({ csrfToken: "algo" }), "x-csrf-token": "algo" },
    });
    expect(response.statusCode).toBe(401);
  });
});
