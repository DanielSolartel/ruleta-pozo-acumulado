import type { User } from "@prisma/client";
import { prisma } from "../../lib/prisma";

export async function findUserByEmail(email: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { email } });
}

export async function findUserById(id: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { id } });
}

export async function createUser(params: {
  id: string;
  email: string;
  passwordHash: string;
}): Promise<User> {
  return prisma.user.create({
    data: {
      id: params.id,
      email: params.email,
      passwordHash: params.passwordHash,
    },
  });
}

export async function recordFailedLogin(userId: string, newAttemptCount: number): Promise<void> {
  const LOCKOUT_THRESHOLD = 5;
  const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

  await prisma.user.update({
    where: { id: userId },
    data: {
      failedLoginAttempts: newAttemptCount,
      lockedUntil:
        newAttemptCount >= LOCKOUT_THRESHOLD ? new Date(Date.now() + LOCKOUT_DURATION_MS) : undefined,
    },
  });
}

export async function resetFailedLoginAttempts(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { failedLoginAttempts: 0, lockedUntil: null },
  });
}

export async function createEmailVerificationToken(params: {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}): Promise<void> {
  await prisma.emailVerificationToken.create({
    data: {
      id: params.id,
      userId: params.userId,
      tokenHash: params.tokenHash,
      expiresAt: params.expiresAt,
    },
  });
}

export async function findEmailVerificationTokenByHash(tokenHash: string) {
  return prisma.emailVerificationToken.findUnique({ where: { tokenHash } });
}

export async function consumeEmailVerificationToken(tokenId: string, userId: string): Promise<void> {
  // Ambas escrituras deben aplicarse juntas: marcar el token como usado y
  // verificar el email es un solo evento de negocio. Se agrupan en una
  // transacción para que no quede el token consumido sin el usuario
  // verificado (o viceversa) si algo falla a mitad de camino.
  await prisma.$transaction([
    prisma.emailVerificationToken.update({
      where: { id: tokenId },
      data: { usedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { emailVerifiedAt: new Date() },
    }),
  ]);
}

export async function createRefreshToken(params: {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}): Promise<void> {
  await prisma.refreshToken.create({
    data: {
      id: params.id,
      userId: params.userId,
      tokenHash: params.tokenHash,
      expiresAt: params.expiresAt,
    },
  });
}

export async function findRefreshTokenByHash(tokenHash: string) {
  return prisma.refreshToken.findUnique({ where: { tokenHash } });
}

export async function revokeRefreshToken(id: string): Promise<void> {
  await prisma.refreshToken.update({
    where: { id },
    data: { revokedAt: new Date() },
  });
}

/** Revoca toda la familia de refresh tokens activos (no revocados) de un usuario. */
export async function revokeAllRefreshTokensForUser(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function getActiveRound() {
  return prisma.potRound.findFirst({ where: { endedAt: null } });
}
