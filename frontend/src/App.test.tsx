import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App", () => {
  it("muestra el texto de setup de V0.2", () => {
    render(<App />);
    expect(
      screen.getByText("Ruleta con Pozo Acumulado — V0.2 setup")
    ).toBeInTheDocument();
  });
});
