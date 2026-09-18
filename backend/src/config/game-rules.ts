/**
 * Reglas de negocio cerradas por el product owner (J.1-J.3, ver docs/spec/,
 * sección J y L.7). Único lugar canónico para estos valores: pruebas
 * unitarias y migraciones deben leerlos de aquí, nunca hardcodearlos.
 *
 * Todos los valores tienen un default y son configurables vía variables de
 * entorno para permitir ajustes sin recompilar (documentado en .env.example).
 */

function parseIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid integer for env var ${name}: "${raw}"`);
  }
  return parsed;
}

/**
 * Como parseIntEnv, pero exige un entero estrictamente positivo (> 0).
 * Usado para valores que no tienen sentido en 0 o negativos, como un
 * denominador de probabilidad.
 */
function parsePositiveIntEnv(name: string, fallback: number): number {
  const parsed = parseIntEnv(name, fallback);
  if (parsed <= 0) {
    throw new Error(
      `Invalid value for env var ${name}: "${parsed}" — debe ser un entero positivo (> 0)`
    );
  }
  return parsed;
}

/**
 * Como parseIntEnv, pero exige un entero no negativo (>= 0). Usado para
 * montos que pueden ser 0 pero nunca negativos.
 */
function parseNonNegativeIntEnv(name: string, fallback: number): number {
  const parsed = parseIntEnv(name, fallback);
  if (parsed < 0) {
    throw new Error(
      `Invalid value for env var ${name}: "${parsed}" — debe ser un entero no negativo (>= 0)`
    );
  }
  return parsed;
}

/**
 * J.1 — pot_minimum: piso del pozo (unidades virtuales, entero). Toda ronda
 * nueva abre con initial_amount = pot_minimum. Puede ser 0 (no tendría
 * sentido negativo).
 */
export const POT_MINIMUM = parseNonNegativeIntEnv("POT_MINIMUM", 100);

/**
 * J.2 — contribution_amount: monto fijo que aporta cada giro no ganador al
 * pozo (unidades virtuales, entero). 0 en giros ganadores (ver spin logic,
 * V0.3). Puede ser 0 (no tendría sentido negativo).
 */
export const CONTRIBUTION_AMOUNT = parseNonNegativeIntEnv("CONTRIBUTION_AMOUNT", 1);

/**
 * J.3 — probabilidad del espacio dorado: p = 1 / GOLD_PROBABILITY_DENOMINATOR,
 * fija e independiente del tamaño del pozo. Pública (ver GET /api/game-info).
 * Debe ser estrictamente positivo: un denominador 0 o negativo no define
 * una probabilidad válida (división por cero o probabilidad sin sentido).
 */
export const GOLD_PROBABILITY_DENOMINATOR = parsePositiveIntEnv(
  "GOLD_PROBABILITY_DENOMINATOR",
  100_000
);

/**
 * Umbral de RNG derivado de la probabilidad: result = "gold" si
 * rng_raw_output < RNG_THRESHOLD, "no_gold" en caso contrario (ver spec, E/F).
 * Se deriva del denominador en vez de hardcodearse, para que cambiar
 * GOLD_PROBABILITY_DENOMINATOR por entorno recalcule el umbral automáticamente.
 */
export const RNG_THRESHOLD = Math.floor(2 ** 53 / GOLD_PROBABILITY_DENOMINATOR);

export const gameRules = {
  potMinimum: POT_MINIMUM,
  contributionAmount: CONTRIBUTION_AMOUNT,
  goldProbabilityDenominator: GOLD_PROBABILITY_DENOMINATOR,
  rngThreshold: RNG_THRESHOLD,
} as const;
