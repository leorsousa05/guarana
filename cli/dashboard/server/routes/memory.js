import express from 'express';
import path from 'node:path';
import { summary, search, graph, injections, drafts, review, createRelationship, deleteRelationship } from '../lib/memory.js';

export function createMemoryRouter({ root }) {
  const router = express.Router();
  const vaultDir = path.join(root, '.guarana', 'memory');

  router.get(['/', '/summary'], async (_req, res) => {
    res.json(await summary(vaultDir));
  });

  router.get('/search', async (req, res) => {
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    res.json(
      await search(vaultDir, {
        q: typeof req.query.q === 'string' ? req.query.q : undefined,
        type: typeof req.query.type === 'string' ? req.query.type : undefined,
        limit,
      })
    );
  });

  router.get('/graph', async (req, res) => {
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    res.json(await graph(vaultDir, { limit }));
  });

  router.get('/injections', async (req, res) => {
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const telemetryFile = path.join(root, '.specs', 'state', 'telemetry', 'events.jsonl');
    res.json(await injections(vaultDir, telemetryFile, { limit }));
  });

  router.get('/drafts', async (_req, res) => {
    res.json(await drafts(vaultDir));
  });

  router.post('/review', async (req, res) => {
    const body = req.body || {};
    const result = await review(vaultDir, {
      id: body.id,
      action: body.action,
      edits: body.edits,
    });
    if (result.error) return res.status(400).json(result);
    res.json(result);
  });

  router.post('/relationships', async (req, res) => {
    const body = req.body || {};
    const result = await createRelationship(vaultDir, {
      from: body.from,
      to: body.to,
      rel: body.rel,
      scope: body.scope,
    });
    if (result.error) return res.status(result.statusCode || 400).json({ error: result.error });
    res.status(201).json(result.edge);
  });

  router.delete('/relationships', async (req, res) => {
    const body = req.body || {};
    const result = await deleteRelationship(vaultDir, {
      from: body.from,
      to: body.to,
      rel: body.rel,
      ts: body.ts,
      scope: body.scope,
    });
    if (result.error) return res.status(result.statusCode || 400).json({ error: result.error });
    res.json(result.edge);
  });

  return router;
}
