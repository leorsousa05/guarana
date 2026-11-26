import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { resolveAllowed, resolveSpecsDir } from '../lib/security.js';

const pendingLineRe = /^\s*-\s*\*\*Decision:\*\*\s*pending:\s*(.*)$/i;
const resolvedLineRe = /^\s*-\s*\*\*Resolved/i;

export function createDecisionsRouter({ root }) {
  const router = express.Router();
  const decisionDirs = (req) => {
    const specsDir = resolveSpecsDir(req.projectRoot || root);
    return specsDir ? [path.join(specsDir, 'decisions'), path.join(specsDir, 'features', 'guarana')] : [];
  };
  const resolveDecisionFile = (file, req) => {
    const dirs = decisionDirs(req);
    const selectedRoot = req.projectRoot || root;
    for (const dir of dirs) {
      const prefix = `${path.relative(selectedRoot, dir)}${path.sep}`;
      if (file.startsWith(prefix)) {
        return resolveAllowed(file.slice(prefix.length), [dir], { requireExt: '.md' });
      }
    }
    if (path.basename(file) !== file) return null;
    return resolveAllowed(file, dirs, { requireExt: '.md' });
  };

  router.get('/pending', (req, res) => {
    const decisions = [];
    const selectedRoot = req.projectRoot || root;
    for (const dir of decisionDirs(req)) {
      let names = [];
      try {
        if (!fs.lstatSync(dir).isDirectory() || fs.realpathSync(dir) !== path.resolve(dir)) continue;
        names = fs.readdirSync(dir).filter((n) => n.endsWith('.md'));
      } catch {
        continue;
      }
      for (const name of names) {
        const allowed = resolveAllowed(name, [dir], { requireExt: '.md' });
        if (!allowed) continue;
        let text;
        try {
          text = fs.readFileSync(allowed.realTarget, 'utf8');
        } catch {
          continue;
        }
        const rel = path.relative(selectedRoot, allowed.resolved);
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

  router.post('/resolve', (req, res) => {
    const body = req.body || {};
    const { file, statement, outcome } = body;
    if (outcome !== 'accepted' && outcome !== 'rejected') return res.status(400).end();
    if (typeof file !== 'string' || file.length === 0) return res.status(400).end();
    if (typeof statement !== 'string') return res.status(400).end();

    const allowed = resolveDecisionFile(file, req);
    if (!allowed) return res.status(400).end();

    let text;
    try {
      text = fs.readFileSync(allowed.realTarget, 'utf8');
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
    fs.appendFileSync(allowed.realTarget, `${sep}${addition}\n`);
    res.json({ ok: true });
  });

  return router;
}
