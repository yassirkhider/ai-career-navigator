import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, validatePasswordStrength } from "./password";

describe("validatePasswordStrength", () => {
  it("rejects passwords shorter than 10 characters", () => {
    expect(validatePasswordStrength("Ab1defgh")).toMatch(/at least 10/i);
  });

  it("rejects passwords without a lowercase letter", () => {
    expect(validatePasswordStrength("ABCDEFG123")).toMatch(/lowercase/i);
  });

  it("rejects passwords without an uppercase letter", () => {
    expect(validatePasswordStrength("abcdefg123")).toMatch(/uppercase/i);
  });

  it("rejects passwords without a number", () => {
    expect(validatePasswordStrength("Abcdefghij")).toMatch(/number/i);
  });

  it("accepts a password meeting all requirements", () => {
    expect(validatePasswordStrength("Abcdefg123")).toBeNull();
  });
});

describe("hashPassword / verifyPassword", () => {
  it("hashes a password and can verify it back", async () => {
    const hash = await hashPassword("Sup3rSecretPass");
    expect(hash).not.toBe("Sup3rSecretPass");
    expect(hash.length).toBeGreaterThan(20);
    await expect(verifyPassword("Sup3rSecretPass", hash)).resolves.toBe(true);
  });

  it("rejects an incorrect password against a real hash", async () => {
    const hash = await hashPassword("Sup3rSecretPass");
    await expect(verifyPassword("WrongPassword1", hash)).resolves.toBe(false);
  });

  it("produces different hashes for the same password (salted)", async () => {
    const hash1 = await hashPassword("SamePassword1");
    const hash2 = await hashPassword("SamePassword1");
    expect(hash1).not.toBe(hash2);
  });
});
