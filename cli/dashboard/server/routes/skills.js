import express from 'express';
import { listGeneratedSkills, readGeneratedSkill } from '../lib/skills.js';

export function createSkillsRouter({ root, homeDir }) {
  const router = express.Router();
  router.get('/', async (req, res) => {
    res.json(await listGeneratedSkills(req.projectRoot || root, { homeDir }));
  });
  router.get('/:scope/:name', async (req, res) => {
    const skill = await readGeneratedSkill(req.projectRoot || root, req.params, { homeDir });
    if (skill.error) return res.status(404).json({ error: skill.error });
    return res.json(skill);
  });
  return router;
}
