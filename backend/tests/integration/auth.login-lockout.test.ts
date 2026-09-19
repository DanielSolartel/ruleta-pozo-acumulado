import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { setupIntegrationTest } from "./helpers";
import { prisma } from "../../src/lib/prisma";
import { hashPassword } from "../../src/modules/auth/password";
import { resetRateLimitBuckets } from "../../src/modules/auth/rateLimitByKey";

const { app } = setupIntegrationTest();

describe("POST /api/auth/login — bloqueo por intentos fallidos", () => {
  it("5 intentos fallidos bloquean la cuenta; el 6º intento (incluso con password correcta) da 423", async () => {
    const id = randomUUID();
    const email = "lockout@example.com";
    await prisma.user.create({
      data: {
        id,
        email,
        passwordHash: await hashPassword("CorrectPassw0rd!23"),
        emailVerifiedAt: new Date(),
      },
    });

    // El límite secundario (5 req/min/email) también dispara a los 5
    // intentos — se resetea el bucket entre intentos de este test para
    // aislar específicamente el comportamiento de bloqueo de CUENTA
    // (failed_login_attempts), no el rate limiting por email.
    for (let i = 0; i < 5; i++) {
      resetRateLimitBuckets();
      const attempt = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email, password: "WrongPassword!" + i },
      });
      expect([401, 423]).toContain(attempt.statusCode);
    }

    const user = await prisma.user.findUnique({ where: { id } });
    expect(user?.failedLoginAttempts).toBe(5);
    expect(user?.lockedUntil).not.toBeNull();

    resetRateLimitBuckets();
    const sixthAttempt = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password: "CorrectPassw0rd!23" }, // password CORRECTA
    });

    expect(sixthAttempt.statusCode).toBe(423);
    expect(sixthAttempt.json().error.code).toBe("account_locked");
  });

  it("failed_login_attempts se reinicia a 0 tras un login exitoso", async () => {
    const id = randomUUID();
    const email = "reset-on-success@example.com";
    await prisma.user.create({
      data: {
        id,
        email,
        passwordHash: await hashPassword("CorrectPassw0rd!23"),
        emailVerifiedAt: new Date(),
        failedLoginAttempts: 3,
      },
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password: "CorrectPassw0rd!23" },
    });

    expect(response.statusCode).toBe(200);
    const user = await prisma.user.findUnique({ where: { id } });
    expect(user?.failedLoginAttempts).toBe(0);
    expect(user?.lockedUntil).toBeNull();
  });

  it("intento con password incorrecta tras locked_until vencido reinicia el contador a 0 y luego cuenta solo este intento (resuelve M2)", async () => {
    const id = randomUUID();
    const email = "expired-lock-wrong-pw@example.com";
    await prisma.user.create({
      data: {
        id,
        email,
        passwordHash: await hashPassword("CorrectPassw0rd!23"),
        emailVerifiedAt: new Date(),
        failedLoginAttempts: 5,
        lockedUntil: new Date(Date.now() - 1000), // ya pasó
      },
    });

    // Contraseña INCORRECTA en este intento. Si el contador no se
    // reiniciara al ver el bloqueo vencido, esto incrementaría 5→6 y
    // volvería a bloquear la cuenta de inmediato con un solo intento.
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password: "WrongPassword!" },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe("invalid_credentials");

    const user = await prisma.user.findUnique({ where: { id } });
    expect(user?.failedLoginAttempts).toBe(1); // reinició a 0, luego +1 por este intento
    expect(user?.lockedUntil).toBeNull();
  });

  it("intento con password correcta tras locked_until vencido reinicia el contador y deja login exitoso", async () => {
    const id = randomUUID();
    const email = "expired-lock@example.com";
    await prisma.user.create({
      data: {
        id,
        email,
        passwordHash: await hashPassword("CorrectPassw0rd!23"),
        emailVerifiedAt: new Date(),
        failedLoginAttempts: 5,
        lockedUntil: new Date(Date.now() - 1000), // ya pasó
      },
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password: "CorrectPassw0rd!23" },
    });

    expect(response.statusCode).toBe(200);
    const user = await prisma.user.findUnique({ where: { id } });
    expect(user?.failedLoginAttempts).toBe(0);
    expect(user?.lockedUntil).toBeNull();
  });
});
