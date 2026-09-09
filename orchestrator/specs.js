// guarana orchestrator - automatic .specs bootstrap for a new project.
// Existing files are never replaced: the first task only creates the minimum
// system of record and a task-specific feature spec for the planning step.

import fs from 'node:fs';
import path from 'node:path';

function cleanTask(task) {
  return String(task || '').replace(/\s+/g, ' ').trim();
}

export function taskSlug(task) {
  return cleanTask(task)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'task';
}

function markdownTask(task) {
  return cleanTask(task).replace(/\|/g, '\\|') || 'Unspecified task';
}

export function ensureSpecs(projectDir, task, now = Date.now()) {
  const text = cleanTask(task);
  const specsDir = path.join(projectDir, '.specs');
  const stateDir = path.join(specsDir, 'state');
  const decisionsDir = path.join(specsDir, 'decisions');
  const featuresDir = path.join(specsDir, 'features');
  const slug = taskSlug(text);
  const featureDir = path.join(featuresDir, slug);
  const featureFile = path.join(featureDir, `${slug}.md`);

  fs.mkdirSync(stateDir, { recursive: true });
  fs.mkdirSync(decisionsDir, { recursive: true });
  fs.mkdirSync(featureDir, { recursive: true });

  const title = markdownTask(text);
  const created = [];
  const writeIfMissing = (file, content) => {
    if (fs.existsSync(file)) return;
    fs.writeFileSync(file, content, 'utf8');
    created.push(file);
  };

  writeIfMissing(
    path.join(specsDir, 'README.md'),
    `# .specs - Guarana System of Record\n\n` +
      `Status pipeline: SPECIFIED -> TASKED -> IMPLEMENTED -> VALIDATED -> SHIPPED\n\n` +
      `| Name | Status | Proof | Change |\n|---|---|---|---|\n` +
      `| ${slug} | SPECIFIED | | |\n\n` +
      `**DONE:** none.\n` +
      `**NEXT:** ${title}\n` +
      `**BLOCKED:** nothing.\n`
  );
  writeIfMissing(
    path.join(stateDir, 'project-state.md'),
    `# Project State\n\n` +
      `Last updated: ${new Date(now).toISOString()}\n\n` +
      `## Current step\n` +
      `Automatic guarana workflow.\n\n` +
      `## Checkpoint\n` +
      `- Goal: ${title}\n` +
      `- Pending writes: planning\n`
  );
  writeIfMissing(
    featureFile,
    `# Feature spec: ${title}\n\n` +
      `**Status:** SPECIFIED\n` +
      `**Date:** ${new Date(now).toISOString().slice(0, 10)}\n\n` +
      `## Goal\n${title}\n\n` +
      `## Acceptance criteria\n` +
      `- The requested behavior is implemented and independently verified.\n\n` +
      `## Definition of done\n` +
      `The active guarana workflow reaches verification with recorded proof.\n`
  );

  return { specsDir, featureFile, created };
}
