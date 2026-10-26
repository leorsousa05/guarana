import express from 'express';
import { listGeneratedSkills } from '../lib/skills.js';

export function createSkillsRouter({ root }) {
  const router = express.Router();
  router.get('/', async (req, res) => {
    res.json(await listGeneratedSkills(req.projectRoot || root));
  });
  return router;
}
