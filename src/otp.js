import { decodeBase32 } from "./base32.js";

function toCounterBytes(counter) {
  const bytes = new Uint8Array(8);
  let value = BigInt(counter);

  for (let index = 7; index >= 0; index -= 1) {
    bytes[index] = Number(value & 0xffn);
    value >>= 8n;
  }

  return bytes;
}

function dynamicTruncate(hmac) {
  const offset = hmac[hmac.length - 1] & 0x0f;
  return (
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  );
}

function formatCode(code, digits) {
  return String(code).padStart(digits, "0");
}

export async function generateHotp({ secretBase32, counter, digits = 6, algorithm = "SHA-1" }) {
  const keyBytes = decodeBase32(secretBase32);
  const counterBytes = toCounterBytes(counter);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: { name: algorithm } },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", cryptoKey, counterBytes);
  const hmac = new Uint8Array(signature);
  const truncated = dynamicTruncate(hmac);
  const modulo = 10 ** digits;
  const otp = truncated % modulo;

  return formatCode(otp, digits);
}

export async function generateTotp({ secretBase32, period = 30, digits = 6, algorithm = "SHA-1", now = Date.now() }) {
  const unixSeconds = Math.floor(now / 1000);
  const counter = Math.floor(unixSeconds / period);
  const code = await generateHotp({ secretBase32, counter, digits, algorithm });
  const remaining = period - (unixSeconds % period);

  return {
    code,
    remaining,
    period,
    counter
  };
}

export function groupOtp(code) {
  if (!code) {
    return "";
  }

  if (code.length === 6) {
    return `${code.slice(0, 3)} ${code.slice(3)}`;
  }

  if (code.length === 8) {
    return `${code.slice(0, 4)} ${code.slice(4)}`;
  }

  return code;
}