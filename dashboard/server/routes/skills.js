import express from 'express';
import { listGeneratedSkills } from '../lib/skills.js';

export function createSkillsRouter({ root }) {
  const router = express.Router();
  router.get('/', async (_req, res) => {
    res.json(await listGeneratedSkills(root));
  });
  return router;
}
