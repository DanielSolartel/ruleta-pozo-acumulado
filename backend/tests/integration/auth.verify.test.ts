import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { setupIntegrationTest } from "./helpers";
import { prisma } from "../../src/lib/prisma";
import { hashPassword } from "../../src/modules/auth/password";
import { generateOpaqueToken, hashEmailVerificationToken } from "../../src/modules/auth/tokens";

const { app } = setupIntegrationTest();

async function createUnverifiedUser() {
  const id = randomUUID();
  await prisma.user.create({
    data: { id, email: `${id}@example.com`, passwordHash: await hashPassword("StrongPassw0rd!23") },
  });
  return id;
}

describe("POST /api/auth/verify", () => {
  it("token válido -> 200 { verified: true }, marca used_at y email_verified_at", async () => {
    const userId = await createUnverifiedUser();
    const token = generateOpaqueToken();
    await prisma.emailVerificationToken.create({
      data: {
        id: randomUUID(),
        userId,
        tokenHash: hashEmailVerificationToken(token),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    const response = await app.inject({ method: "POST", url: "/api/auth/verify", payload: { token } });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ verified: true });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    expect(user?.emailVerifiedAt).not.toBeNull();
  });

  it("token expirado -> 410 token_expired", async () => {
    const userId = await createUnverifiedUser();
    const token = generateOpaqueToken();
    await prisma.emailVerificationToken.create({
      data: {
        id: randomUUID(),
        userId,
        tokenHash: hashEmailVerificationToken(token),
        expiresAt: new Date(Date.now() - 1000),
      },
    });

    const response = await app.inject({ method: "POST", url: "/api/auth/verify", payload: { token } });
    expect(response.statusCode).toBe(410);
    expect(response.json().error.code).toBe("token_expired");
  });

  it("token ya usado -> 404 token_invalid", async () => {
    const userId = await createUnverifiedUser();
    const token = generateOpaqueToken();
    await prisma.emailVerificationToken.create({
      data: {
        id: randomUUID(),
        userId,
        tokenHash: hashEmailVerificationToken(token),
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: new Date(),
      },
    });

    const response = await app.inject({ method: "POST", url: "/api/auth/verify", payload: { token } });
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe("token_invalid");
  });

  it("token inexistente -> 404 token_invalid", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/verify",
      payload: { token: "un-token-que-nunca-se-emitio" },
    });
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe("token_invalid");
  });
});
