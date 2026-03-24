const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const BASE32_MAP = new Map([...BASE32_ALPHABET].map((char, index) => [char, index]));

export function normalizeBase32(input) {
  if (typeof input !== "string") {
    return "";
  }

  return input.toUpperCase().replace(/[\s-]/g, "").replace(/=+$/g, "");
}

export function decodeBase32(input) {
  const normalized = normalizeBase32(input);

  if (!normalized) {
    throw new Error("Secret is required.");
  }

  let bits = 0;
  let value = 0;
  const output = [];

  for (const char of normalized) {
    const index = BASE32_MAP.get(char);

    if (index === undefined) {
      throw new Error(`Invalid Base32 character: ${char}`);
    }

    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  if (output.length === 0) {
    throw new Error("Secret could not be decoded.");
  }

  return new Uint8Array(output);
}