import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app";

describe("GET /health", () => {
  it("responde 200 con { status: \"ok\" }", async () => {
    const app = buildApp();
    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });
});
