// guarana memory — secret detection/redaction. Zero deps.
// isSensitive(text): hard-reject shapes (.env blocks, keys, tokens, private keys).
// sanitize(text): redacts secret-shaped assignments/values with [REDACTED].

const HARD_PATTERNS = [
  /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/,
  /\bsk-[A-Za-z0-9_-]{8,}/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bghp_[A-Za-z0-9]{8,}\b/,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{10,}/i,
];

const ENV_LINE = /^[A-Za-z_][A-Za-z0-9_]*=\S+$/;

// Redactable: generic secret assignments (key=value / key: value).
const ASSIGN_RE =
  /(\b(?:api[_-]?key|secret|password|passwd|token|credential)\b\s*[:=]\s*)(["']?)[^\s"']+\2/gi;

export function isSensitive(text) {
  if (typeof text !== "string" || !text) return false;
  if (HARD_PATTERNS.some((re) => re.test(text))) return true;
  const envLines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => ENV_LINE.test(l));
  return envLines.length >= 2; // .env-style key=value block
}

export function sanitize(text) {
  if (typeof text !== "string") return text;
  let out = text.replace(ASSIGN_RE, "$1[REDACTED]");
  out = out
    .replace(/-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/g, "[REDACTED]")
    .replace(/\bsk-[A-Za-z0-9_-]{8,}/g, "[REDACTED]")
    .replace(/\bAKIA[0-9A-Z]{16}\b/g, "[REDACTED]")
    .replace(/\bghp_[A-Za-z0-9]{8,}\b/g, "[REDACTED]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{10,}/gi, "Bearer [REDACTED]");
  return out;
}
