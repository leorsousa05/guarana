import fs from 'node:fs';
import path from 'node:path';

/**
 * Parse the master tracker table in `.specs/README.md` into structured rows
 * plus DONE / NEXT / BLOCKED flags. Pure function, fully testable.
 */
export function parseTracker(markdown) {
  const rows = [];
  const flags = { DONE: [], NEXT: [], BLOCKED: [], other: [] };
  for (const rawLine of markdown.split('\n')) {
    const line = rawLine.trim();
    if (line.startsWith('|') && line.endsWith('|')) {
      const cells = line.slice(1, -1).split('|').map((c) => c.trim());
      if (cells.length < 2) continue;
      const isSeparator = cells.every((c) => /^:?-{3,}:?$/.test(c));
      const isHeader = cells[0].toLowerCase() === 'skill' || cells[0].toLowerCase() === 'name';
      if (isSeparator || isHeader) continue;
      rows.push({
        skill: cells[0] ?? '',
        status: cells[1] ?? '',
        proof: cells[2] ?? '',
        change: cells[3] ?? '',
      });
    } else {
      const m = line.match(/^\*\*(DONE|NEXT|BLOCKED):\*\*\s*(.*)$/i);
      if (m) flags[m[1].toUpperCase()].push(m[2]);
      else if (/^\*\*/.test(line) && /:\*\*/.test(line)) flags.other.push(line);
    }
  }
  return { rows, ...flags };
}

/**
 * Recursively list all `.md` files under a directory, sorted.
 */
export function listSpecFiles(dir) {
  const out = [];
  const walk = (current, rel) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      const nextRel = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(full, nextRel);
      else if (entry.isFile() && entry.name.endsWith('.md')) out.push(nextRel);
    }
  };
  walk(dir, '');
  return out.sort();
}
