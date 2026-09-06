import express from 'express';
import { current } from '../lib/workflow.js';

export function createWorkflowRouter({ root }) {
  const router = express.Router();

  router.get('/current', async (_req, res) => {
    res.json(await current(root));
  });

  return router;
}