import { describe, expect, it } from "vitest";
import { gameRules, RNG_THRESHOLD } from "../src/config/game-rules";

describe("game-rules (J.1-J.3 config)", () => {
  it("usa los defaults documentados cuando no hay variables de entorno", () => {
    expect(gameRules.potMinimum).toBe(100);
    expect(gameRules.contributionAmount).toBe(1);
    expect(gameRules.goldProbabilityDenominator).toBe(100000);
  });

  it("deriva rng_threshold = floor(2^53 / denominator)", () => {
    const expected = Math.floor(2 ** 53 / gameRules.goldProbabilityDenominator);
    expect(RNG_THRESHOLD).toBe(expected);
    expect(RNG_THRESHOLD).toBe(90071992547);
  });
});
