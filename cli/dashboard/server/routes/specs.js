import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { parseTracker, listSpecFiles } from '../lib/specs.js';
import { resolveAllowed, resolveSpecsDir } from '../lib/security.js';

export function createSpecsRouter({ root }) {
  const router = express.Router();
  const specsDir = (req) => resolveSpecsDir(req.projectRoot || root);

  router.get('/tracker', (req, res) => {
    let markdown = '';
    const directory = specsDir(req);
    const allowed = directory && resolveAllowed('README.md', [directory], { requireExt: '.md' });
    if (!allowed) return res.json({ rows: [], DONE: [], NEXT: [], BLOCKED: [], other: [] });
    try {
      markdown = fs.readFileSync(allowed.realTarget, 'utf8');
    } catch {
      return res.json({ rows: [], DONE: [], NEXT: [], BLOCKED: [], other: [] });
    }
    res.json(parseTracker(markdown));
  });

  router.get('/tree', (req, res) => {
    let files = [];
    try {
      const directory = specsDir(req);
      if (directory) files = listSpecFiles(directory);
    } catch {
      /* no specs dir */
    }
    res.json({ files });
  });

  router.get('/file', (req, res) => {
    const rel = req.query.path;
    const directory = specsDir(req);
    const allowed = directory && resolveAllowed(rel, [directory], { requireExt: '.md' });
    if (!allowed) return res.status(400).end();
    try {
      return res.type('text/markdown').send(fs.readFileSync(allowed.realTarget, 'utf8'));
    } catch {
      return res.status(404).end();
    }
  });

  router.get('/state', (req, res) => {
    const read = (name) => {
      const directory = specsDir(req);
      const allowed = directory && resolveAllowed(path.join('state', name), [directory], { requireExt: '.md' });
      if (!allowed) return '';
      try {
        return fs.readFileSync(allowed.realTarget, 'utf8');
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
