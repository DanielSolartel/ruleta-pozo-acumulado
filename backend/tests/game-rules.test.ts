import { afterEach, describe, expect, it, vi } from "vitest";

const ENV_KEYS = [
  "POT_MINIMUM",
  "CONTRIBUTION_AMOUNT",
  "GOLD_PROBABILITY_DENOMINATOR",
] as const;

async function loadGameRules() {
  vi.resetModules();
  return import("../src/config/game-rules");
}

afterEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
});

describe("game-rules (J.1-J.3 config)", () => {
  it("usa los defaults documentados cuando no hay variables de entorno", async () => {
    const { gameRules } = await loadGameRules();
    expect(gameRules.potMinimum).toBe(100);
    expect(gameRules.contributionAmount).toBe(1);
    expect(gameRules.goldProbabilityDenominator).toBe(100000);
  });

  it("deriva rng_threshold = floor(2^53 / denominator)", async () => {
    const { gameRules, RNG_THRESHOLD } = await loadGameRules();
    const expected = Math.floor(2 ** 53 / gameRules.goldProbabilityDenominator);
    expect(RNG_THRESHOLD).toBe(expected);
    expect(RNG_THRESHOLD).toBe(90071992547);
  });

  it("acepta POT_MINIMUM = 0 (no negativo, válido)", async () => {
    process.env.POT_MINIMUM = "0";
    const { gameRules } = await loadGameRules();
    expect(gameRules.potMinimum).toBe(0);
  });

  it("rechaza POT_MINIMUM negativo (A2)", async () => {
    process.env.POT_MINIMUM = "-1";
    await expect(loadGameRules()).rejects.toThrow(/no negativo/);
  });

  it("rechaza CONTRIBUTION_AMOUNT negativo (A2)", async () => {
    process.env.CONTRIBUTION_AMOUNT = "-5";
    await expect(loadGameRules()).rejects.toThrow(/no negativo/);
  });

  it("rechaza GOLD_PROBABILITY_DENOMINATOR = 0 (A2)", async () => {
    process.env.GOLD_PROBABILITY_DENOMINATOR = "0";
    await expect(loadGameRules()).rejects.toThrow(/positivo/);
  });

  it("rechaza GOLD_PROBABILITY_DENOMINATOR negativo (A2)", async () => {
    process.env.GOLD_PROBABILITY_DENOMINATOR = "-100";
    await expect(loadGameRules()).rejects.toThrow(/positivo/);
  });
});
