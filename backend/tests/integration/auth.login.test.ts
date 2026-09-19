import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { setupIntegrationTest } from "./helpers";
import { prisma } from "../../src/lib/prisma";
import { hashPassword } from "../../src/modules/auth/password";

const { app } = setupIntegrationTest();

async function createVerifiedUser(email: string, password: string) {
  const id = randomUUID();
  await prisma.user.create({
    data: {
      id,
      email,
      passwordHash: await hashPassword(password),
      emailVerifiedAt: new Date(),
    },
  });
  return id;
}

function getCookie(response: { cookies: Array<{ name: string; value: string }> }, name: string) {
  return response.cookies.find((c) => c.name === name);
}

describe("POST /api/auth/login", () => {
  it("credenciales correctas + cuenta verificada -> 200 + 3 cookies", async () => {
    await createVerifiedUser("login-ok@example.com", "CorrectPassw0rd!23");

    const response = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "login-ok@example.com", password: "CorrectPassw0rd!23" },
    });

    expect(response.statusCode).toBe(200);
    const access = getCookie(response, "accessToken");
    const refresh = getCookie(response, "refreshToken");
    const csrf = getCookie(response, "csrfToken");

    expect(access?.httpOnly).toBe(true);
    expect(refresh?.httpOnly).toBe(true);
    expect(refresh?.path).toBe("/api/auth/refresh");
    expect(csrf?.httpOnly).toBeFalsy();
  });

  it("password incorrecto -> 401 invalid_credentials", async () => {
    await createVerifiedUser("wrongpass@example.com", "CorrectPassw0rd!23");

    const response = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "wrongpass@example.com", password: "IncorrectPassw0rd!99" },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe("invalid_credentials");
  });

  it("email inexistente -> 401 invalid_credentials (sin enumeración)", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "no-existe@example.com", password: "CualquierCosa!123" },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe("invalid_credentials");
  });

  it("cuenta bloqueada -> 423 account_locked", async () => {
    const id = await createVerifiedUser("bloqueada@example.com", "CorrectPassw0rd!23");
    await prisma.user.update({
      where: { id },
      data: { lockedUntil: new Date(Date.now() + 60_000) },
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "bloqueada@example.com", password: "CorrectPassw0rd!23" },
    });

    expect(response.statusCode).toBe(423);
    expect(response.json().error.code).toBe("account_locked");
  });

  it("cuenta no verificada -> 403 email_not_verified, sin cookies", async () => {
    const id = randomUUID();
    await prisma.user.create({
      data: {
        id,
        email: "no-verificada@example.com",
        passwordHash: await hashPassword("CorrectPassw0rd!23"),
        // emailVerifiedAt queda null
      },
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "no-verificada@example.com", password: "CorrectPassw0rd!23" },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe("email_not_verified");
    expect(getCookie(response, "accessToken")).toBeUndefined();
  });
});
