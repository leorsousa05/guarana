import express from 'express';

export function createProjectsRouter({ registry }) {
  const router = express.Router();

  router.get('/', (_req, res) => {
    try { res.json(registry.list()); }
    catch { res.status(500).json({ error: 'Unable to load projects.' }); }
  });

  router.post('/', (req, res) => {
    const body = req.body;
    const contentType = req.get('content-type');
    const hasUnparsedBody = (contentType !== undefined && !/^application\/json(?:\s*;|$)/i.test(contentType))
      || (body === undefined && (
        req.get('transfer-encoding') !== undefined
        || Number(req.get('content-length') || 0) > 0
      ));
    if (hasUnparsedBody || (body !== undefined && (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 0))) {
      return res.status(400).json({ error: 'Project registration does not accept request fields.' });
    }
    try { res.status(201).json({ project: registry.registerCurrent() }); }
    catch { res.status(500).json({ error: 'Unable to register the current project.' }); }
  });

  router.delete('/:id', (req, res) => {
    try {
      if (!registry.unregister(req.params.id)) return res.status(404).json({ error: 'Project is not registered.' });
      res.json({ ok: true });
    } catch { res.status(500).json({ error: 'Unable to unregister the project.' }); }
  });

  return router;
}
