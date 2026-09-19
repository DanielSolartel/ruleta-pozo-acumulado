import { execSync } from "node:child_process";
import { afterAll, beforeAll, beforeEach } from "vitest";
import { buildApp } from "../../src/app";
import { prisma } from "../../src/lib/prisma";
import { resetRateLimitBuckets } from "../../src/modules/auth/rateLimitByKey";
import { setMailerForTesting, type EmailMessage, type Mailer } from "../../src/modules/audit/mailer";

/**
 * Setup compartido para los tests de integración: requiere una base de
 * datos Postgres real accesible vía DATABASE_URL (ver README — el mismo
 * criterio que documenta la spec como alternativa a testcontainers: usar
 * el servicio Postgres ya definido en docker-compose/CI, con una base de
 * datos separada `ruleta_pozo_acumulado_test`).
 *
 * NO se usa testcontainers (requiere Docker, no disponible en el entorno
 * de esta entrega) — se usa la alternativa que la propia spec autoriza.
 */

export interface TestMailer extends Mailer {
  sent: EmailMessage[];
}

export function createTestMailer(): TestMailer {
  const sent: EmailMessage[] = [];
  return {
    sent,
    async send(message: EmailMessage) {
      sent.push(message);
    },
  };
}

export function setupIntegrationTest() {
  const app = buildApp();
  const mailer = createTestMailer();

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error(
        "DATABASE_URL no está definida — los tests de integración necesitan una Postgres real (ver README)"
      );
    }
    // Aplica el schema más reciente contra la base de datos de test.
    // `prisma db push` no genera un archivo de migración (no lo
    // necesitamos aquí, solo sincronizar el schema para probar).
    execSync("npx prisma db push --skip-generate --accept-data-loss", {
      cwd: process.cwd(),
      stdio: "inherit",
    });
    await app.ready();
  });

  beforeEach(async () => {
    setMailerForTesting(mailer);
    mailer.sent.length = 0;
    resetRateLimitBuckets();
    // Orden de borrado respetando FKs (RESTRICT): hijos antes que padres.
    await prisma.idempotencyKey.deleteMany();
    await prisma.potWin.deleteMany();
    await prisma.$executeRawUnsafe(`UPDATE "pot_rounds" SET "winner_spin_id" = NULL`);
    await prisma.spin.deleteMany();
    await prisma.emailVerificationToken.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.potRound.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  return { app, mailer };
}
