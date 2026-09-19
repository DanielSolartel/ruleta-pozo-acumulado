import { describe, expect, it } from "vitest";
import { setupIntegrationTest } from "./helpers";
import { gameRules } from "../../src/config/game-rules";

const { app } = setupIntegrationTest();

describe("GET /api/game-info", () => {
  it("devuelve los 3 valores de game-rules.ts, sin autenticación", async () => {
    const response = await app.inject({ method: "GET", url: "/api/game-info" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      goldProbabilityDenominator: gameRules.goldProbabilityDenominator,
      contributionAmount: gameRules.contributionAmount,
      potMinimum: gameRules.potMinimum,
    });
  });
});
