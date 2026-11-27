import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  acceptLearningReviewProposal,
  enqueueLearningReviewProposal,
  getLearningReviewProposal,
  learningReviewQueuePath,
  listLearningReviewProposals,
  rejectLearningReviewProposal,
} from './learning-review-queue.js';
import { initVault, paths } from './vault.js';
import { addNode } from './graph.js';
import { createSkill, listSkills, readSkill } from '../skill-engine/index.js';

const project = () => fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-review-queue-'));

const memoryProposal = {
  action: 'save_memory',
  reason: 'The validation procedure is reusable.',
  memory: {
    type: 'solution',
    intent: 'Validation workflow',
    summary: 'Run the focused validation check before the full suite.',
    tags: ['validation', 'testing'],
  },
};

const createSkillProposal = {
  action: 'create_skill',
  reason: 'The validation procedure is reusable.',
  skill: {
    name: 'review-validation',
    description: 'Validate reusable project workflows.',
    category: 'development',
    scope: 'project',
    content: '# Validation workflow Run focused checks before the full suite.',
  },
};

const updateSkillProposal = {
  action: 'update_skill',
  reason: 'The validation procedure needs a focused update.',
  skill: {
    name: 'review-validation-update',
    description: 'Update reusable project workflows.',
    category: 'development',
    scope: 'project',
    expectedRevision: 'a'.repeat(64),
    content: '# Updated validation workflow Run focused checks first.',
  },
};

test('project memory and skill proposals persist in their own queue across reopen, then apply without graph drafts', async (t) => {
  const projectDir = project();
  t.after(() => fs.rmSync(projectDir, { recursive: true, force: true }));
  const vaultDir = initVault(projectDir);
  const draft = {
    id: 'draft-existing',
    ts: 1,
    type: 'decision',
    status: 'draft',
    scope: 'project',
    intent: 'Existing graph draft',
    summary: 'This legacy draft remains separate.',
    tags: [],
  };
  addNode(vaultDir, draft);

  const memory = enqueueLearningReviewProposal(projectDir, memoryProposal);
  const skill = enqueueLearningReviewProposal(projectDir, createSkillProposal);
  const updateSkill = enqueueLearningReviewProposal(projectDir, updateSkillProposal);
  const expectedMemory = {
    ...memoryProposal,
    memory: { ...memoryProposal.memory, scope: 'project' },
  };
  assert.deepEqual(listLearningReviewProposals(projectDir).map(({ proposal }) => proposal), [
    expectedMemory,
    createSkillProposal,
    updateSkillProposal,
  ]);
  assert.notEqual(learningReviewQueuePath(projectDir), paths(vaultDir).drafts);
  assert.equal(fs.existsSync(path.join(paths(vaultDir).drafts, `${memory.id}.json`)), false);

  const reopened = listLearningReviewProposals(projectDir);
  assert.equal(reopened[0].status, 'pending');
  assert.equal(reopened[0].proposal.memory.scope, 'project');
  assert.deepEqual(reopened[1].proposal, createSkillProposal);
  assert.deepEqual(reopened[2].proposal, updateSkillProposal);

  const child = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import { listLearningReviewProposals } from ${JSON.stringify(new URL('./learning-review-queue.js', import.meta.url).href)};
    const entries = listLearningReviewProposals(process.argv[1]);
    process.stdout.write(JSON.stringify(entries.map(({ status, proposal }) => ({ status, proposal }))));
  `, projectDir], { encoding: 'utf8' });
  assert.equal(child.status, 0, child.stderr);
  assert.deepEqual(JSON.parse(child.stdout), [
    { status: 'pending', proposal: expectedMemory },
    { status: 'pending', proposal: createSkillProposal },
    { status: 'pending', proposal: updateSkillProposal },
  ]);

  const savedMemory = await acceptLearningReviewProposal(projectDir, memory.id);
  assert.equal(savedMemory.status, 'applied');
  assert.equal(savedMemory.result.status, 'confirmed');
  assert.equal(savedMemory.result.scope, 'project');
  assert.deepEqual(
    fs.readFileSync(paths(vaultDir).nodes, 'utf8').trim().split('\n').map(JSON.parse).map(({ id, status }) => ({ id, status })),
    [{ id: draft.id, status: 'draft' }, { id: savedMemory.result.id, status: 'confirmed' }],
  );

  const savedSkill = await acceptLearningReviewProposal(projectDir, skill.id);
  assert.equal(savedSkill.status, 'applied');
  assert.equal(savedSkill.result.created, true);
  assert.equal(listSkills({ projectDir }).project[0].name, createSkillProposal.skill.name);
  await assert.rejects(acceptLearningReviewProposal(projectDir, memory.id), /expected pending/i);
});

test('manual rejection is durable and cannot be replayed', (t) => {
  const projectDir = project();
  t.after(() => fs.rmSync(projectDir, { recursive: true, force: true }));
  const entry = enqueueLearningReviewProposal(projectDir, memoryProposal);

  const rejected = rejectLearningReviewProposal(projectDir, entry.id);
  assert.equal(rejected.status, 'rejected');
  assert.equal(getLearningReviewProposal(projectDir, entry.id).status, 'rejected');
  assert.throws(() => rejectLearningReviewProposal(projectDir, entry.id), /expected pending or approved/i);
  assert.equal(listLearningReviewProposals(projectDir).length, 1);
});

test('confirmed subject can be re-enqueued without assuming unavailable proposal details', (t) => {
  const projectDir = project();
  t.after(() => fs.rmSync(projectDir, { recursive: true, force: true }));
  const subject = 'Ignore unknown flags in the web CLI';
  const entry = enqueueLearningReviewProposal(projectDir, {
    action: 'save_memory',
    reason: 'Original proposal text and ID are unavailable; original confirmation is unknown.',
    memory: {
      type: 'solution',
      intent: subject,
      summary: 'Original proposal text and ID are unavailable; original confirmation is unknown.',
      tags: ['proposal-details-unavailable'],
    },
  });

  assert.match(entry.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  assert.equal(entry.status, 'pending');
  assert.equal(entry.proposal.action, 'save_memory');
  assert.equal(entry.proposal.memory.type, 'solution');
  assert.equal(entry.proposal.memory.intent, subject);
});

test('stale skill updates stay pending and cannot overwrite the current revision', async (t) => {
  const projectDir = project();
  t.after(() => fs.rmSync(projectDir, { recursive: true, force: true }));
  createSkill({
    projectDir,
    name: 'review-update',
    description: 'An existing generated skill.',
    category: 'development',
    scope: 'project',
    content: '# Original workflow',
  });
  const current = listSkills({ projectDir, includeRevision: true }).project[0];
  const stale = enqueueLearningReviewProposal(projectDir, {
    action: 'update_skill',
    reason: 'The existing procedure needs a focused check.',
    skill: {
      name: current.name,
      description: 'A stale replacement.',
      category: 'development',
      scope: 'project',
      expectedRevision: '0'.repeat(64),
      content: '# Stale replacement',
    },
  });

  await assert.rejects(acceptLearningReviewProposal(projectDir, stale.id), /changed since skill_list/i);
  assert.equal(getLearningReviewProposal(projectDir, stale.id).status, 'pending');
  assert.deepEqual(getLearningReviewProposal(projectDir, stale.id).proposal.skill, {
    name: current.name,
    description: 'A stale replacement.',
    category: 'development',
    scope: 'project',
    content: '# Stale replacement',
    expectedRevision: '0'.repeat(64),
  });
  const unchanged = listSkills({ projectDir, includeRevision: true }).project[0];
  assert.equal(unchanged.revision, current.revision);
  assert.equal(unchanged.description, current.description);

  const update = enqueueLearningReviewProposal(projectDir, {
    action: 'update_skill',
    reason: 'The exact revision allows a safe replacement.',
    skill: {
      name: current.name,
      description: 'An updated generated skill.',
      category: 'development',
      scope: 'project',
      expectedRevision: current.revision,
      content: '# Updated workflow',
    },
  });
  assert.equal(listLearningReviewProposals(projectDir).find((entry) => entry.id === update.id).proposal.skill.expectedRevision,
    current.revision);
  const applied = await acceptLearningReviewProposal(projectDir, update.id);
  assert.equal(applied.status, 'applied');
  const updated = listSkills({ projectDir, includeRevision: true }).project[0];
  assert.equal(updated.description, 'An updated generated skill.');
  assert.match(readSkill({ projectDir, name: current.name, scope: 'project' }).content, /Updated workflow/);
});

test('failed direct applications return to pending, while malformed queues fail closed', async (t) => {
  const projectDir = project();
  t.after(() => fs.rmSync(projectDir, { recursive: true, force: true }));
  const entry = enqueueLearningReviewProposal(projectDir, memoryProposal);
  await assert.rejects(
    acceptLearningReviewProposal(projectDir, entry.id, {
      applyProposal: async () => ({ error: 'injected application failure' }),
    }),
    /injected application failure/,
  );
  assert.equal(getLearningReviewProposal(projectDir, entry.id).status, 'pending');

  fs.writeFileSync(learningReviewQueuePath(projectDir), '{', 'utf8');
  assert.throws(() => listLearningReviewProposals(projectDir), /cannot be read/);
  assert.throws(() => enqueueLearningReviewProposal(projectDir, memoryProposal), /cannot be read/);
});
