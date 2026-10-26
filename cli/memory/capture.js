// Legacy capture entry point retained for compatibility. New project writes no
// longer admit atoms; legacy records remain available through explicit reads.
import crypto from "node:crypto";
import path from "node:path";
import { isSensitive } from "./security.js";

export function projectHashFor(projectDir) {
  return crypto.createHash("sha1").update(path.resolve(projectDir)).digest("hex").slice(0, 12);
}

const TEXT_FIELDS = ["intent", "input", "output", "decision"];

// Returns a safe refusal without touching the vault. Sensitivity detection is
// retained so callers receive the more specific legacy security result.
export function captureAtom(_vaultDir, eventData = {}) {
  const text = TEXT_FIELDS.map((f) => eventData[f])
    .concat(eventData.summary ? [eventData.summary] : [])
    .filter((v) => typeof v === "string")
    .join("\n");
  if (isSensitive(text)) return { captured: false, reason: "sensitive-content" };
  return { captured: false, reason: "legacy-capture-disabled" };
}
