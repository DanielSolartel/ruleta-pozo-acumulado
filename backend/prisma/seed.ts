import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { gameRules } from "../src/config/game-rules";

const prisma = new PrismaClient();

/**
 * Crea la primera ronda activa si no existe ninguna todavía. Idempotente:
 * si ya hay una ronda con ended_at IS NULL, no hace nada (permite correr
 * el seed más de una vez sin duplicar rondas — el índice único parcial
 * one_open_round lo impediría de todas formas, pero así se evita el error
 * y el mensaje es más claro).
 */
async function main() {
  const existing = await prisma.potRound.findFirst({ where: { endedAt: null } });

  if (existing) {
    console.log(
      JSON.stringify({ seed: "pot_round", action: "skipped", reason: "already exists", roundId: existing.id })
    );
    return;
  }

  const round = await prisma.potRound.create({
    data: {
      id: randomUUID(),
      initialAmount: gameRules.potMinimum,
      startedAt: new Date(),
      endedAt: null,
    },
  });

  console.log(
    JSON.stringify({
      seed: "pot_round",
      action: "created",
      roundId: round.id,
      initialAmount: gameRules.potMinimum,
    })
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
