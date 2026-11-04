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

// Redactable: generic and provider-prefixed secret assignments.
const SECRET_NAME_SOURCE = String.raw`\b(?:[A-Za-z0-9]+[_-])*(?:api[_-]?key|access[_-]?key|private[_-]?key|secret|password|passwd|passphrase|pg[_-]?password|pass|pwd|token|credential)(?:[_-][A-Za-z0-9]+)*\b`;
const QUOTED_VALUE_SOURCE = String.raw`(?:\\*"(?:\\.|[^"\\])*\\*"|\\*'(?:\\.|[^'\\])*\\*')\S*`;
const ASSIGN_RE = new RegExp(
  `(${SECRET_NAME_SOURCE}\\s*[:=]\\s*)(?:${QUOTED_VALUE_SOURCE}|[^\\s"']+)`,
  "gi",
);
// Detection is derived from the redaction shape but stays non-global so test()
// cannot leak lastIndex state between sensitive-content checks.
const SENSITIVE_ASSIGN_RE = new RegExp(ASSIGN_RE.source, "i");
const REDACTED_ASSIGN_RE = new RegExp(
  `(${SECRET_NAME_SOURCE}\\s*[:=]\\s*)(["']?)\\[REDACTED\\]\\2(?=$|\\s|[),.;](?=\\s|$))`,
  "gi",
);

export function hasSensitiveAssignment(text) {
  return typeof text === "string" && SENSITIVE_ASSIGN_RE.test(text.replace(REDACTED_ASSIGN_RE, "[REDACTED]"));
}

export function isSensitive(text) {
  if (typeof text !== "string" || !text) return false;
  if (HARD_PATTERNS.some((re) => re.test(text))) return true;
  const envLines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => ENV_LINE.test(l));
  return envLines.length >= 2; // .env-style key=value block
}

export function filterSensitiveTags(tags) {
  if (!Array.isArray(tags)) return [];
  const values = tags.filter((tag) => typeof tag === "string" && tag);
  const containsSensitiveBlock = isSensitive(values.join("\n"));
  return values.filter((tag) =>
    !isSensitive(tag) && !hasSensitiveAssignment(tag) && !(containsSensitiveBlock && ENV_LINE.test(tag.trim()))
  );
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
