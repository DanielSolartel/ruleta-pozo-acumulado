import { describe, expect, it } from "vitest";
import { setupIntegrationTest } from "./helpers";
import { prisma } from "../../src/lib/prisma";

const { app, mailer } = setupIntegrationTest();

describe("POST /api/auth/register", () => {
  it("registro con email nuevo -> 201, crea usuario y emite token de verificación", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email: "nuevo@example.com", password: "StrongPassw0rd!23" },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(typeof body.userId).toBe("string");

    const user = await prisma.user.findUnique({ where: { email: "nuevo@example.com" } });
    expect(user).not.toBeNull();
    expect(user?.id).toBe(body.userId);
    expect(user?.emailVerifiedAt).toBeNull();

    const tokenRow = await prisma.emailVerificationToken.findFirst({ where: { userId: user!.id } });
    expect(tokenRow).not.toBeNull();
    expect(tokenRow?.usedAt).toBeNull();

    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0].to).toBe("nuevo@example.com");
    expect(mailer.sent[0].subject).toContain("Verifica");
  });

  it("registro con email ya existente -> 201 igual, pero NO crea un usuario nuevo (resuelve N5)", async () => {
    const first = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email: "repetido@example.com", password: "StrongPassw0rd!23" },
    });
    expect(first.statusCode).toBe(201);
    const firstUserId = first.json().userId;

    const usersAfterFirst = await prisma.user.count();

    const second = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email: "repetido@example.com", password: "OtherPassw0rd!45" },
    });

    // Misma forma de respuesta, mismo código, pero userId distinto (no
    // referencia a nadie real) y ningún usuario nuevo creado.
    expect(second.statusCode).toBe(201);
    expect(typeof second.json().userId).toBe("string");
    expect(second.json().userId).not.toBe(firstUserId);

    const usersAfterSecond = await prisma.user.count();
    expect(usersAfterSecond).toBe(usersAfterFirst);

    // Se envió el email "ya tienes una cuenta", no uno de verificación.
    expect(mailer.sent).toHaveLength(2);
    expect(mailer.sent[1].subject).toContain("Ya tienes una cuenta");
  });

  it("password débil -> 422 weak_password con details", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email: "debil@example.com", password: "corta1" },
    });

    expect(response.statusCode).toBe(422);
    const body = response.json();
    expect(body.error.code).toBe("weak_password");
    expect(Array.isArray(body.error.details)).toBe(true);
    expect(body.error.details.length).toBeGreaterThan(0);

    const user = await prisma.user.findUnique({ where: { email: "debil@example.com" } });
    expect(user).toBeNull();
  });

  it("email con formato inválido -> 422 con details", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email: "no-es-un-email", password: "StrongPassw0rd!23" },
    });
    expect(response.statusCode).toBe(422);
    expect(response.json().error.details.some((d: { field: string }) => d.field === "email")).toBe(true);
  });
});
