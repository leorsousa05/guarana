import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { GuaranaMemory } from './guarana-memory.js';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { initVault } from '../memory/vault.js';

describe('GuaranaMemory', () => {
  let tmpDir;
  let eventsFile;
  let api;
  const vaultDir = () => path.join(tmpDir, '.guarana', 'memory');
  const nodesFile = () => path.join(vaultDir(), 'nodes.jsonl');

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-mem-plugin-'));
    api = await GuaranaMemory({ directory: tmpDir });
    eventsFile = path.join(tmpDir, '.specs', 'state', 'telemetry', 'events.jsonl');
  });

  afterEach(() => {
    // restore perms in case a test made the vault read-only
    try {
      fs.chmodSync(nodesFile(), 0o644);
      fs.chmodSync(vaultDir(), 0o755);
    } catch { /* ignore */ }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function readEvents() {
    try {
      return fs.readFileSync(eventsFile, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
    } catch {
      return [];
    }
  }

  function readNodes() {
    try {
      return fs.readFileSync(nodesFile(), 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
    } catch {
      return [];
    }
  }

  it('does not register automatic capture hooks', () => {
    assert.equal(api['tool.execute.before'], undefined);
    assert.equal(api['tool.execute.after'], undefined);
    assert.equal(api['file.edited'], undefined);
  });

  it('injects automatic memory rules distinguishing global preferences from project decisions', async () => {
    const output = { system: [] };
    await api['experimental.chat.system.transform']({}, output);
    assert.match(output.system.join('\n'), /automatically.*clear/i);
    assert.match(output.system.join('\n'), /scope: "global"/);
    assert.match(output.system.join('\n'), /scope: "project"/);
    assert.match(output.system.join('\n'), /ordinary task requests/);
    assert.match(output.system.join('\n'), /Guarana automatic skills/);
    assert.match(output.system.join('\n'), /skill_list/);
    assert.match(output.system.join('\n'), /After completing task work and before the final response, assess/i);
    assert.match(output.system.join('\n'), /One task can reveal reusable context/i);
    assert.match(output.system.join('\n'), /do not wait for repeated requests, an explicit checklist, or an explicit skill-creation command/i);
    assert.match(output.system.join('\n'), /reusable workflow, project knowledge, conventions, or context/i);
    assert.match(output.system.join('\n'), /application architecture\/components and how to work with or change them/i);
    assert.match(output.system.join('\n'), /positive trigger even when the user did not explicitly ask/i);
    assert.match(output.system.join('\n'), /Repeatable sequences\/checklists/);
    assert.match(output.system.join('\n'), /specialized recurring checks/);
    assert.match(output.system.join('\n'), /corrections meant to guide similar future work are also positive triggers/);
    assert.match(output.system.join('\n'), /Example to create:/);
    assert.match(output.system.join('\n'), /is one-off\./);
    assert.match(output.system.join('\n'), /temporary acceptance criteria/);
    assert.match(output.system.join('\n'), /generic best practices/);
    assert.match(output.system.join('\n'), /or a simple task/i);
    assert.match(output.system.join('\n'), /long, technical, or complex is not itself a signal/);
    assert.match(output.system.join('\n'), /If future reuse is ambiguous, do not create a skill/i);
    assert.match(output.system.join('\n'), /preferences and decisions belong in memory/i);
    assert.match(output.system.join('\n'), /Do not duplicate the same content across both/);
    assert.match(output.system.join('\n'), /Call `skill_list` to check Guarana-generated skills in both scopes and avoid semantic duplicates/i);
    assert.match(output.system.join('\n'), /choose a distinct name and never overwrite the existing skill/i);
    assert.match(output.system.join('\n'), /skill_create/);
    assert.match(output.system.join('\n'), /When a reusable procedure or project context is clear, call `skill_create`/);
    assert.match(output.system.join('\n'), /Choose `project`/);
    assert.match(output.system.join('\n'), /Choose `global`/);
    assert.match(output.system.join('\n'), /Never copy secrets, credentials, private data, or raw conversation transcripts/i);
  });

  it('keeps normal tool activity out of the memory vault', async () => {
    initVault(tmpDir);
    await api['session.created']({ properties: { info: { id: 's1' } } });
    assert.equal(readNodes().length, 0);
    assert.equal(readEvents().filter((e) => e.type === 'memory-captured').length, 0);
    assert.equal(readEvents().filter((e) => e.type === 'memory-session').length, 1);
  });

  it('creates confirmed memory only through the explicit decision tool', async () => {
    const result = JSON.parse(await api.tool.memory_save_decision.execute({
      intent: 'choose explicit memory',
      decision: 'Only deliberate decisions enter long-term memory.',
      rejectedAlternatives: ['Capture every tool call'],
      tags: ['policy'],
      author: 'test',
    }));
    assert.equal(result.status, 'confirmed');
    assert.equal(result.type, 'decision');
    assert.equal(readNodes().length, 1);
  });

  it('saves a typed bug and connects its solution with a fixes edge', async () => {
    const bug = JSON.parse(await api.tool.memory_save_node.execute({
      type: 'bug',
      intent: 'memory retrieval loses related bugs',
      summary: 'The context tool returns only the matching decision.',
      tags: ['memory'],
    }));
    const solution = JSON.parse(await api.tool.memory_save_node.execute({
      type: 'solution',
      intent: 'include related bug context',
      summary: 'Expand task context across explicit fixes links.',
      relatedTo: [{ id: bug.id, rel: 'fixes' }],
    }));
    assert.equal(bug.type, 'bug');
    assert.equal(solution.type, 'solution');
    assert.equal(solution.edges[0].rel, 'fixes');
    assert.equal(solution.edges[0].to, bug.id);
    const edges = fs.readFileSync(path.join(vaultDir(), 'edges.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
    assert.equal(edges.length, 1);
  });

  it('stores an automatic standing preference in the user vault, not the project vault', async () => {
    const oldHome = process.env.HOME;
    const fakeHome = path.join(tmpDir, 'user-home');
    fs.mkdirSync(fakeHome, { recursive: true });
    process.env.HOME = fakeHome;
    try {
      const result = JSON.parse(await api.tool.memory_save_node.execute({
        type: 'preference',
        scope: 'global',
        intent: 'response language',
        summary: 'Always answer me in Portuguese.',
      }));
      const globalNodes = fs.readFileSync(path.join(fakeHome, '.config', 'guarana', 'memory', 'nodes.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
      assert.equal(result.scope, 'global');
      assert.equal(globalNodes.length, 1);
      assert.equal(readNodes().length, 0);
      const context = JSON.parse(await api.tool.memory_get_context_for_task.execute({
        task: 'build a database migration',
        scope: 'both',
      }));
      assert.equal(context.preferences.length, 1);
      assert.equal(context.preferences[0].id, result.id);
      const search = JSON.parse(await api.tool.memory_search.execute({
        query: 'Portuguese',
        scope: 'both',
      }));
      assert.equal(search.results.length, 1);
      assert.equal(search.results[0].scope, 'global');
    } finally {
      if (oldHome === undefined) delete process.env.HOME;
      else process.env.HOME = oldHome;
    }
  });

  it('creates a reusable project skill and lists it without a filesystem path', async () => {
    const result = JSON.parse(await api.tool.skill_create.execute({
      name: 'node-red-review',
      description: 'Review and validate Node-RED flows.',
      scope: 'project',
      content: '# Node-RED review\n\nInspect flow nodes, validate wiring, then run the focused checks.',
    }));
    assert.equal(result.created, true);
    assert.equal(result.scope, 'project');
    assert.ok(fs.existsSync(path.join(tmpDir, '.opencode', 'skills', 'node-red-review', 'SKILL.md')));

    const listing = JSON.parse(await api.tool.skill_list.execute({}));
    assert.deepEqual(listing.project.map((skill) => skill.name), ['node-red-review']);
    assert.equal(JSON.stringify(listing).includes(tmpDir), false);
  });

  it('stores portable skills globally and keeps them out of the project scope', async () => {
    const oldHome = process.env.HOME;
    const fakeHome = path.join(tmpDir, 'user-home');
    fs.mkdirSync(fakeHome, { recursive: true });
    process.env.HOME = fakeHome;
    try {
      const result = JSON.parse(await api.tool.skill_create.execute({
        name: 'clear-technical-explanations',
        description: 'Explain technical changes clearly to a non-specialist.',
        scope: 'global',
        content: '# Clear explanations\n\nState the result first, then describe the relevant technical details in plain language.',
      }));
      assert.equal(result.scope, 'global');
      const file = path.join(fakeHome, '.agents', 'skills', 'clear-technical-explanations', 'SKILL.md');
      assert.ok(fs.existsSync(file));
      const listing = JSON.parse(await api.tool.skill_list.execute({ scope: 'global' }));
      assert.deepEqual(listing.global.map((skill) => skill.name), ['clear-technical-explanations']);
      assert.equal('project' in listing, false);
    } finally {
      if (oldHome === undefined) delete process.env.HOME;
      else process.env.HOME = oldHome;
    }
  });

  it('does not overwrite a same-named skill and rejects secrets and invalid scopes', async () => {
    const name = 'safe-review';
    const file = path.join(tmpDir, '.opencode', 'skills', name, 'SKILL.md');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, 'user-authored skill');
    const duplicate = JSON.parse(await api.tool.skill_create.execute({
      name,
      description: 'A reviewed skill.',
      scope: 'global',
      content: '# Review\n\nFollow the stable review steps.',
    }));
    assert.match(duplicate.error, /already exists in project scope/);
    assert.equal(fs.readFileSync(file, 'utf8'), 'user-authored skill');

    const secret = JSON.parse(await api.tool.skill_create.execute({
      name: 'credential-handling',
      description: 'Handle credentials.',
      scope: 'project',
      content: '# Credentials\n\nAPI key: ghp_abcdefgh12345678',
    }));
    assert.match(secret.error, /secret/);
    const invalidScope = JSON.parse(await api.tool.skill_create.execute({
      name: 'another-skill',
      description: 'A valid description.',
      scope: '../../outside',
      content: '# Safe\n\nThis is a valid body.',
    }));
    assert.match(invalidScope.error, /scope/);
  });
});
