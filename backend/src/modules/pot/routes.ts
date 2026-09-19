import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../../lib/prisma";
import { getActiveRound } from "../auth/repository";
import { gameRules } from "../../config/game-rules";

const PUBLIC_RATE_LIMIT = { max: 30, timeWindow: "1 minute" } as const;

export async function registerPotRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /api/game-info ─────────────────────────────────────────────────
  // Sin DB: expone los valores ya cerrados de J.1-J.3, leídos de
  // game-rules.ts (nada hardcodeado aquí).
  app.get(
    "/api/game-info",
    { config: { rateLimit: PUBLIC_RATE_LIMIT } },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.code(200).send({
        goldProbabilityDenominator: gameRules.goldProbabilityDenominator,
        contributionAmount: gameRules.contributionAmount,
        potMinimum: gameRules.potMinimum,
      });
    }
  );

  // ── GET /api/pot ────────────────────────────────────────────────────────
  app.get(
    "/api/pot",
    { config: { rateLimit: PUBLIC_RATE_LIMIT } },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const round = await getActiveRound();

      if (!round) {
        // Invariante violado: siempre debe existir una ronda abierta (la
        // garantiza el índice único parcial one_open_round una vez
        // sembrada la primera con prisma/seed.ts). Si esto ocurre, el
        // seed no corrió — error de configuración, no un caso de negocio.
        return reply.code(500).send({
          error: { code: "no_active_round", message: "no active pot round found — did the seed run?" },
        });
      }

      // currentAmount = initial_amount + suma de contribution_amount de los
      // giros no ganadores de esta ronda. En V0.3 no existen giros todavía
      // (POST /api/spins es V0.3.1), así que esto siempre da initial_amount
      // — se escribe la consulta real igualmente para que ya esté correcta
      // cuando existan spins.
      const aggregate = await prisma.spin.aggregate({
        where: { roundId: round.id, result: "no_gold" },
        _sum: { contributionAmount: true },
      });

      const contributed = aggregate._sum.contributionAmount ?? 0;
      const currentAmount = Number(round.initialAmount) + Number(contributed);

      // updatedAt: no existe una columna dedicada en pot_rounds para "última
      // modificación". En V0.3, sin spins todavía, se usa started_at. Desde
      // V0.3.1 (cuando existan giros) debería pasar a reflejar el timestamp
      // del último giro que afectó esta ronda — decisión documentada aquí
      // porque la spec no define una columna updated_at explícita.
      return reply.code(200).send({
        roundId: round.id,
        currentAmount,
        updatedAt: round.startedAt.toISOString(),
      });
    }
  );
}
