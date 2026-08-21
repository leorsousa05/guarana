import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.GUARANA_DASH_PORT || 4200;
// Project root = cwd of the server process.
const root = process.cwd();
const specsDir = path.join(root, '.specs');
const telemetryFile = path.join(specsDir, 'state', 'telemetry', 'events.jsonl');

const app = express();
app.use(express.json());

function readJsonl(file) {
  try {
    const text = fs.readFileSync(file, 'utf8');
    const events = [];
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        events.push(JSON.parse(trimmed));
      } catch {
        // skip malformed line
      }
    }
    return events;
  } catch {
    return [];
  }
}

function summarize(events) {
  const sessions = new Map();
  for (const ev of events) {
    const sid = ev.sessionID;
    if (!sid) continue;
    let s = sessions.get(sid);
    if (!s) {
      s = {
        sessionID: sid,
        start: null,
        end: null,
        durationMs: null,
        toolCalls: 0,
        errors: 0,
        tokens: 0,
        eventCount: 0,
      };
      sessions.set(sid, s);
    }
    s.eventCount += 1;
    if (typeof ev.ts === 'number') {
      if (s.start === null || ev.ts < s.start) s.start = ev.ts;
      if (s.end === null || ev.ts > s.end) s.end = ev.ts;
    }
    if (ev.type === 'tool') {
      s.toolCalls += 1;
      if (ev.ok === false || ev.error) s.errors += 1;
    }
    if (ev.type === 'session' && ev.status === 'error') s.errors += 1;
    if (typeof ev.tokens === 'number') s.tokens += ev.tokens;
  }
  const runs = [...sessions.values()];
  for (const r of runs) {
    if (r.start !== null && r.end !== null) r.durationMs = r.end - r.start;
  }
  runs.sort((a, b) => (b.start ?? 0) - (a.start ?? 0));
  return runs;
}

function parseTracker(markdown) {
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

app.get('/api/telemetry/summary', (_req, res) => {
  const events = readJsonl(telemetryFile);
  res.json({ runs: summarize(events) });
});

app.get('/api/telemetry/events', (req, res) => {
  const session = req.query.session;
  const events = readJsonl(telemetryFile);
  const filtered = session ? events.filter((e) => e.sessionID === session) : events;
  res.json({ events: filtered });
});

app.get('/api/specs/tracker', (_req, res) => {
  let markdown = '';
  try {
    markdown = fs.readFileSync(path.join(specsDir, 'README.md'), 'utf8');
  } catch {
    return res.json({ rows: [], DONE: [], NEXT: [], BLOCKED: [], other: [] });
  }
  res.json(parseTracker(markdown));
});

function listSpecFiles(dir) {
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

app.get('/api/specs/tree', (_req, res) => {
  let files = [];
  try {
    files = listSpecFiles(specsDir);
  } catch {
    /* no specs dir */
  }
  res.json({ files });
});

app.get('/api/specs/file', (req, res) => {
  const rel = req.query.path;
  if (typeof rel !== 'string' || rel.length === 0) return res.status(400).end();
  if (path.isAbsolute(rel)) return res.status(400).end();
  const root = path.resolve(specsDir);
  const resolved = path.resolve(root, rel);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) return res.status(400).end();
  if (!resolved.endsWith('.md')) return res.status(400).end();
  let realTarget, realRoot;
  try {
    realTarget = fs.realpathSync(resolved);
    realRoot = fs.realpathSync(root);
  } catch {
    return res.status(404).end();
  }
  if (realTarget !== realRoot && !realTarget.startsWith(realRoot + path.sep)) return res.status(400).end();
  try {
    return res.type('text/markdown').send(fs.readFileSync(realTarget, 'utf8'));
  } catch {
    return res.status(404).end();
  }
});

app.get('/api/specs/state', (_req, res) => {
  const read = (name) => {
    try {
      return fs.readFileSync(path.join(specsDir, 'state', name), 'utf8');
    } catch {
      return '';
    }
  };
  res.json({
    projectState: read('project-state.md'),
    knownIssues: read('known-issues.md'),
  });
});

const decisionDirs = [
  path.join(specsDir, 'decisions'),
  path.join(specsDir, 'features', 'guarana'),
];
const pendingLineRe = /^\s*-\s*\*\*Decision:\*\*\s*pending:\s*(.*)$/i;
const resolvedLineRe = /^\s*-\s*\*\*Resolved/i;

app.get('/api/decisions/pending', (_req, res) => {
  const decisions = [];
  for (const dir of decisionDirs) {
    let names = [];
    try {
      names = fs.readdirSync(dir).filter((n) => n.endsWith('.md'));
    } catch {
      continue;
    }
    for (const name of names) {
      const full = path.join(dir, name);
      let text;
      try {
        text = fs.readFileSync(full, 'utf8');
      } catch {
        continue;
      }
      const rel = path.relative(root, full);
      const lines = text.split('\n');
      const alreadyResolved = lines.some((l) => resolvedLineRe.test(l));
      for (const line of lines) {
        const m = line.match(pendingLineRe);
        if (!m || alreadyResolved) continue;
        decisions.push({ file: rel, statement: m[1].trim() });
      }
    }
  }
  res.json({ decisions });
});

app.post('/api/decisions/resolve', (req, res) => {
  const body = req.body || {};
  const { file, statement, outcome } = body;
  if (outcome !== 'accepted' && outcome !== 'rejected') return res.status(400).end();
  if (typeof file !== 'string' || file.length === 0) return res.status(400).end();
  if (typeof statement !== 'string') return res.status(400).end();
  if (path.isAbsolute(file)) return res.status(400).end();
  if (!file.endsWith('.md')) return res.status(400).end();
  const resolved = path.resolve(root, file);
  const allowedRoots = decisionDirs.map((d) => path.resolve(d));
  if (!allowedRoots.some((r) => resolved === r || resolved.startsWith(r + path.sep))) {
    return res.status(400).end();
  }
  let realTarget, realRoots;
  try {
    realTarget = fs.realpathSync(resolved);
    realRoots = allowedRoots.map((r) => fs.realpathSync(r));
  } catch {
    return res.status(404).end();
  }
  if (!realRoots.some((r) => realTarget === r || realTarget.startsWith(r + path.sep))) {
    return res.status(400).end();
  }
  let text;
  try {
    text = fs.readFileSync(realTarget, 'utf8');
  } catch {
    return res.status(404).end();
  }
  const lines = text.split('\n');
  const hasPending = lines.some((l) => pendingLineRe.test(l));
  const alreadyResolved = lines.some((l) => resolvedLineRe.test(l));
  if (alreadyResolved || !hasPending) return res.status(409).end();
  const today = new Date().toISOString().slice(0, 10);
  const addition = `- **Resolved (${today}):** ${outcome} — via dashboard.`;
  const sep = text.endsWith('\n') ? '' : '\n';
  fs.appendFileSync(realTarget, `${sep}${addition}\n`);
  res.json({ ok: true });
});

// Serve built frontend.
const distDir = path.join(__dirname, '..', 'web', 'dist');
app.use(express.static(distDir));
app.get('*', (_req, res) => {
  const index = path.join(distDir, 'index.html');
  if (fs.existsSync(index)) return res.sendFile(index);
  res.status(503).send('Frontend not built. Run `npm run build` in dashboard/.');
});

app.listen(PORT, () => {
  console.log(`guarana dashboard listening on http://localhost:${PORT}`);
  console.log(`project root: ${root}`);
});
