import argon2 from "argon2";

/**
 * Política de contraseñas (ver spec, F/M3): mínimo 12 caracteres, al menos
 * 3 de las 4 clases (mayúscula, minúscula, dígito, símbolo).
 */
const MIN_LENGTH = 12;

const CLASS_PATTERNS = [
  /[a-z]/, // minúscula
  /[A-Z]/, // mayúscula
  /[0-9]/, // dígito
  /[^a-zA-Z0-9]/, // símbolo
];

export interface PasswordPolicyResult {
  valid: boolean;
  issues: string[];
}

/**
 * Valida la política de contraseñas sin lanzar: devuelve { valid, issues }
 * para que el caller construya la respuesta 422 con `details` (ver F, B3).
 */
export function checkPasswordPolicy(password: string): PasswordPolicyResult {
  const issues: string[] = [];

  if (password.length < MIN_LENGTH) {
    issues.push(`must be at least ${MIN_LENGTH} characters long`);
  }

  const classesPresent = CLASS_PATTERNS.filter((pattern) => pattern.test(password)).length;
  if (classesPresent < 3) {
    issues.push("must contain at least 3 of: uppercase, lowercase, digit, symbol");
  }

  return { valid: issues.length === 0, issues };
}

/**
 * Parámetros de Argon2id recomendados por OWASP (2024): memoryCost 19456 KiB,
 * timeCost 2, parallelism 1.
 */
const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password);
}

/**
 * Hash fijo (dummy) usado para gastar el mismo tiempo aproximado que una
 * verificación real de Argon2id, cuando el email de login no existe — evita
 * filtrar la existencia de la cuenta por temporización (ver spec, login).
 * Generado una sola vez, perezosamente, con los mismos parámetros que
 * hashPassword(); el valor en sí no protege nada (no hay contraseña real
 * detrás), solo sirve para tener ALGO contra lo que correr argon2.verify().
 * Se genera en runtime en vez de hardcodearse como string para garantizar
 * que el formato PHC es válido (un string construido a mano podría no
 * serlo, y argon2.verify() lanzaría en vez de devolver false).
 */
let dummyHashPromise: Promise<string> | null = null;

export function getDummyPasswordHash(): Promise<string> {
  if (!dummyHashPromise) {
    dummyHashPromise = hashPassword("dummy-password-for-timing-safety-only");
  }
  return dummyHashPromise;
}
