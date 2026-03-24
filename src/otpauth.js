import { normalizeBase32 } from "./base32.js";

function normalizeAlgorithm(value) {
  const normalized = String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

  return normalized || "SHA1";
}

function parseInteger(value, fieldName) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    throw new Error(`${fieldName} must be an integer.`);
  }

  return parsed;
}

function decodeLabel(pathname) {
  const raw = pathname.startsWith("/") ? pathname.slice(1) : pathname;

  if (!raw) {
    return "";
  }

  try {
    return decodeURIComponent(raw).trim();
  } catch {
    throw new Error("Invalid URI label encoding.");
  }
}

export function parseOtpAuthUri(rawUri) {
  const uri = String(rawUri || "").trim();

  if (!uri) {
    throw new Error("otpauth URI is required.");
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(uri);
  } catch {
    throw new Error("Invalid otpauth URI.");
  }

  if (parsedUrl.protocol !== "otpauth:") {
    throw new Error("URI must start with otpauth://.");
  }

  const type = parsedUrl.hostname.toLowerCase();

  if (type !== "totp" && type !== "hotp") {
    throw new Error("URI type must be totp or hotp.");
  }

  const label = decodeLabel(parsedUrl.pathname);
  const query = parsedUrl.searchParams;
  const secretBase32 = normalizeBase32(query.get("secret") || "");

  if (!secretBase32) {
    throw new Error("URI must include a secret parameter.");
  }

  const issuer = String(query.get("issuer") || "").trim();
  const algorithm = normalizeAlgorithm(query.get("algorithm"));

  if (algorithm !== "SHA1") {
    throw new Error("Only SHA1 algorithm is supported.");
  }

  const digits = query.has("digits") ? parseInteger(query.get("digits"), "digits") : 6;
  const period = query.has("period") ? parseInteger(query.get("period"), "period") : 30;

  if (period <= 0) {
    throw new Error("period must be greater than 0.");
  }

  const hasCounter = query.has("counter") && String(query.get("counter") || "").trim() !== "";
  const counter = hasCounter ? parseInteger(query.get("counter"), "counter") : null;

  if (counter !== null && counter < 0) {
    throw new Error("counter must be greater than or equal to 0.");
  }

  if (type === "totp") {
    if (digits !== 6) {
      throw new Error("TOTP digits must be 6.");
    }

    if (period !== 30) {
      throw new Error("TOTP period must be 30.");
    }
  } else {
    if (digits !== 6 && digits !== 8) {
      throw new Error("HOTP digits must be 6 or 8.");
    }

    if (counter === null) {
      throw new Error("HOTP URI must include counter.");
    }
  }

  const finalLabel = label || issuer;

  if (!finalLabel) {
    throw new Error("URI label is required.");
  }

  return {
    label: finalLabel,
    secretBase32,
    type,
    digits: type === "totp" ? 6 : digits,
    period: 30,
    counter: type === "hotp" ? counter : 0,
    algorithm: "SHA-1"
  };
}