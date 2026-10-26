import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { parseTracker, listSpecFiles } from '../lib/specs.js';
import { SPECS_DIR } from '../lib/constants.js';
import { resolveAllowed } from '../lib/security.js';

export function createSpecsRouter({ root }) {
  const router = express.Router();
  const specsDir = (req) => path.join(req.projectRoot || root, SPECS_DIR);

  router.get('/tracker', (req, res) => {
    let markdown = '';
    try {
      markdown = fs.readFileSync(path.join(specsDir(req), 'README.md'), 'utf8');
    } catch {
      return res.json({ rows: [], DONE: [], NEXT: [], BLOCKED: [], other: [] });
    }
    res.json(parseTracker(markdown));
  });

  router.get('/tree', (req, res) => {
    let files = [];
    try {
      files = listSpecFiles(specsDir(req));
    } catch {
      /* no specs dir */
    }
    res.json({ files });
  });

  router.get('/file', (req, res) => {
    const rel = req.query.path;
    const allowed = resolveAllowed(rel, [specsDir(req)], { requireExt: '.md' });
    if (!allowed) return res.status(400).end();
    try {
      return res.type('text/markdown').send(fs.readFileSync(allowed.realTarget, 'utf8'));
    } catch {
      return res.status(404).end();
    }
  });

  router.get('/state', (req, res) => {
    const selectedSpecsDir = specsDir(req);
    const read = (name) => {
      try {
        return fs.readFileSync(path.join(selectedSpecsDir, 'state', name), 'utf8');
      } catch {
        return '';
      }
    };
    res.json({
      projectState: read('project-state.md'),
      knownIssues: read('known-issues.md'),
    });
  });

  return router;
}
