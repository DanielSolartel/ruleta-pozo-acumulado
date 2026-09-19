import { describe, expect, it } from "vitest";
import {
  checkPasswordPolicy,
  hashPassword,
  verifyPassword,
  getDummyPasswordHash,
} from "../src/modules/auth/password";

describe("checkPasswordPolicy", () => {
  it("rechaza contraseñas de menos de 12 caracteres", () => {
    const result = checkPasswordPolicy("Ab1!Ab1!Ab1"); // 11 chars
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes("12 characters"))).toBe(true);
  });

  it("rechaza contraseñas con menos de 3 clases de carácter", () => {
    const result = checkPasswordPolicy("aaaaaaaaaaaaaaaa"); // solo minúsculas
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes("3 of"))).toBe(true);
  });

  it("acepta una contraseña de 12+ caracteres con 3 clases (mayúscula, minúscula, dígito)", () => {
    const result = checkPasswordPolicy("Password12345");
    expect(result).toEqual({ valid: true, issues: [] });
  });

  it("acepta una contraseña de 12+ caracteres con exactamente 3 clases (sin símbolo)", () => {
    const result = checkPasswordPolicy("AbcdefghIJ12");
    expect(result.valid).toBe(true);
  });

  it("acepta una contraseña con las 4 clases", () => {
    const result = checkPasswordPolicy("MyStrongP@ss1");
    expect(result.valid).toBe(true);
  });

  it("caso límite: exactamente 12 caracteres es válido en longitud", () => {
    const result = checkPasswordPolicy("Aa1!Aa1!Aa1!"); // 12 chars, 4 clases
    expect(result.issues.some((i) => i.includes("12 characters"))).toBe(false);
  });

  it("caso límite: 11 caracteres es inválido en longitud", () => {
    const result = checkPasswordPolicy("Aa1!Aa1!Aa1"); // 11 chars
    expect(result.issues.some((i) => i.includes("12 characters"))).toBe(true);
  });
});

describe("hashPassword / verifyPassword (Argon2id real)", () => {
  it("produce un hash con el prefijo $argon2id$", async () => {
    const hash = await hashPassword("MyStrongP@ssw0rd123");
    expect(hash.startsWith("$argon2id$")).toBe(true);
  });

  it("verifica correctamente una contraseña correcta", async () => {
    const hash = await hashPassword("correct horse battery staple 1!");
    await expect(verifyPassword(hash, "correct horse battery staple 1!")).resolves.toBe(true);
  });

  it("rechaza una contraseña incorrecta", async () => {
    const hash = await hashPassword("correct horse battery staple 1!");
    await expect(verifyPassword(hash, "wrong password")).resolves.toBe(false);
  });

  it("dos hashes de la misma contraseña son distintos (salt aleatorio)", async () => {
    const h1 = await hashPassword("same-password-123!ABC");
    const h2 = await hashPassword("same-password-123!ABC");
    expect(h1).not.toBe(h2);
  });
});

describe("getDummyPasswordHash (timing-safety, login sin enumeración)", () => {
  it("devuelve un hash Argon2id válido, verificable sin lanzar", async () => {
    const dummy = await getDummyPasswordHash();
    expect(dummy.startsWith("$argon2id$")).toBe(true);
    await expect(verifyPassword(dummy, "cualquier cosa")).resolves.toBe(false);
  });

  it("devuelve el mismo hash en llamadas repetidas (cacheado, no genera uno nuevo cada vez)", async () => {
    const a = await getDummyPasswordHash();
    const b = await getDummyPasswordHash();
    expect(a).toBe(b);
  });
});
