import express from 'express';
import path from 'node:path';
import { summary, search, graph, injections, preferences, drafts, review, createRelationship, deleteRelationship } from '../lib/memory.js';

const invalidQuery = Symbol('invalid memory query');
const validScopes = new Set(['project', 'global']);
const validPreferenceCategories = new Set(['agent_behavior', 'workflow', 'communication', 'general']);
const validPreferenceStatuses = new Set(['active', 'superseded', 'all']);

function readScope(req, res) {
  const scope = req.query.scope;
  if (scope === undefined) return undefined;
  if (typeof scope === 'string' && validScopes.has(scope)) return scope;
  res.status(400).json({ error: 'scope must be "project" or "global".' });
  return invalidQuery;
}

function readStringQuery(value, name, res) {
  if (value === undefined) return undefined;
  if (typeof value === 'string') return value;
  res.status(400).json({ error: `${name} must be a single string value.` });
  return invalidQuery;
}

export function createMemoryRouter({ root }) {
  const router = express.Router();
  const vaultDir = (req) => path.join(req.projectRoot || root, '.guarana', 'memory');

  router.get(['/', '/summary'], async (req, res) => {
    const scope = readScope(req, res);
    if (scope === invalidQuery) return;
    res.json(await summary(vaultDir(req), { scope }));
  });

  router.get('/search', async (req, res) => {
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    res.json(
      await search(vaultDir(req), {
        q: typeof req.query.q === 'string' ? req.query.q : undefined,
        type: typeof req.query.type === 'string' ? req.query.type : undefined,
        limit,
      })
    );
  });

  router.get('/graph', async (req, res) => {
    const scope = readScope(req, res);
    if (scope === invalidQuery) return;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    res.json(await graph(vaultDir(req), { limit, scope }));
  });

  router.get('/injections', async (req, res) => {
    const scope = readScope(req, res);
    if (scope === invalidQuery) return;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const selectedRoot = req.projectRoot || root;
    const telemetryFile = path.join(selectedRoot, '.specs', 'state', 'telemetry', 'events.jsonl');
    res.json(await injections(vaultDir(req), telemetryFile, { limit, scope }));
  });

  router.get('/preferences', async (req, res) => {
    const q = readStringQuery(req.query.q, 'q', res);
    if (q === invalidQuery) return;
    const requestedCategory = readStringQuery(req.query.category, 'category', res);
    if (requestedCategory === invalidQuery) return;
    const requestedStatus = readStringQuery(req.query.status, 'status', res);
    if (requestedStatus === invalidQuery) return;
    const category = requestedCategory || undefined;
    const status = requestedStatus || undefined;
    if (category !== undefined && !validPreferenceCategories.has(category)) {
      return res.status(400).json({ error: 'category must be agent_behavior, workflow, communication, or general.' });
    }
    if (status !== undefined && !validPreferenceStatuses.has(status)) {
      return res.status(400).json({ error: 'status must be active, superseded, or all.' });
    }
    res.json(await preferences({ q, category, status }));
  });

  router.get('/drafts', async (req, res) => {
    res.json(await drafts(vaultDir(req)));
  });

  router.post('/review', async (req, res) => {
    const body = req.body || {};
    const result = await review(vaultDir(req), {
      id: body.id,
      action: body.action,
      edits: body.edits,
    });
    if (result.error) return res.status(400).json(result);
    res.json(result);
  });

  router.post('/relationships', async (req, res) => {
    const body = req.body || {};
    const result = await createRelationship(vaultDir(req), {
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
    const result = await deleteRelationship(vaultDir(req), {
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
