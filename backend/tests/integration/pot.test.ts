import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { setupIntegrationTest } from "./helpers";
import { prisma } from "../../src/lib/prisma";
import { gameRules } from "../../src/config/game-rules";

const { app } = setupIntegrationTest();

describe("GET /api/pot", () => {
  it("devuelve la ronda activa con currentAmount = initial_amount cuando no hay spins", async () => {
    const round = await prisma.potRound.create({
      data: { id: randomUUID(), initialAmount: gameRules.potMinimum, startedAt: new Date(), endedAt: null },
    });

    const response = await app.inject({ method: "GET", url: "/api/pot" });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.roundId).toBe(round.id);
    expect(body.currentAmount).toBe(gameRules.potMinimum);
    expect(typeof body.updatedAt).toBe("string");
  });

  it("sin ninguna ronda activa (seed no corrido) -> 500 no_active_round", async () => {
    const response = await app.inject({ method: "GET", url: "/api/pot" });
    expect(response.statusCode).toBe(500);
    expect(response.json().error.code).toBe("no_active_round");
  });
});
