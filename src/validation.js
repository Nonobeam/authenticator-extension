import { decodeBase32, normalizeBase32 } from "./base32.js";

const ALLOWED_DIGITS = new Set([6, 8]);

export function validateAccountInput(rawInput) {
  const label = String(rawInput.label || "").trim();
  const type = rawInput.type === "hotp" ? "hotp" : "totp";
  const digitsInput = Number(rawInput.digits);
  const digits = type === "totp" ? 6 : digitsInput;
  const period = 30;
  const counter = Number(rawInput.counter);
  const secretBase32 = normalizeBase32(String(rawInput.secretBase32 || ""));

  if (!label) {
    throw new Error("Name is required.");
  }

  if (!secretBase32) {
    throw new Error("Secret is required.");
  }

  decodeBase32(secretBase32);

  if (!ALLOWED_DIGITS.has(digits)) {
    throw new Error("Digits must be 6 or 8.");
  }

  if (type === "hotp") {
    if (!Number.isInteger(counter) || counter < 0) {
      throw new Error("Counter must be an integer greater than or equal to 0.");
    }
  }

  return {
    label,
    secretBase32,
    type,
    digits,
    period: 30,
    counter: type === "hotp" ? counter : 0,
    algorithm: "SHA-1"
  };
}