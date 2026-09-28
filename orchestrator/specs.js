// guarana orchestrator - automatic .specs bootstrap for a new project.
// Existing files are never replaced: cold start creates a generic placeholder
// spec; the planning step interprets the user's request and defines the task.

import fs from 'node:fs';
import path from 'node:path';

function taskContent(task) {
  return String(task || '').replace(/\r\n?/g, '\n').trim();
}

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
  return taskContent(task) || 'Unspecified task';
}

export function ensureSpecs(projectDir, task, now = Date.now()) {
  const text = taskContent(task);
  const specsDir = path.join(projectDir, '.specs');
  const stateDir = path.join(specsDir, 'state');
  const decisionsDir = path.join(specsDir, 'decisions');
  const featuresDir = path.join(specsDir, 'features');
  const slug = 'initial-task';
  const featureDir = path.join(featuresDir, slug);
  const featureFile = path.join(featureDir, `${slug}.md`);

  fs.mkdirSync(stateDir, { recursive: true });
  fs.mkdirSync(decisionsDir, { recursive: true });
  fs.mkdirSync(featureDir, { recursive: true });

  const title = 'Initial task';
  const markdown = markdownTask(text);
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
      `| Initial task | SPECIFIED | | |\n\n` +
      `**DONE:** none.\n` +
      `**NEXT:** Interpret the incoming request and define the task spec.\n` +
      `**BLOCKED:** nothing.\n`
  );
  writeIfMissing(
    path.join(stateDir, 'project-state.md'),
    `# Project State\n\n` +
      `Last updated: ${new Date(now).toISOString()}\n\n` +
      `## Current step\n` +
      `Automatic guarana workflow.\n\n` +
      `## Checkpoint\n` +
      `- Request context: ${markdown}\n` +
      `- Pending writes: planning\n`
  );
  writeIfMissing(
    featureFile,
    `# Feature spec: ${title}\n\n` +
      `**Status:** SPECIFIED\n` +
      `**Date:** ${new Date(now).toISOString().slice(0, 10)}\n\n` +
      `## Planning required\nInterpret the incoming request and define a concise goal and acceptance criteria.\n\n` +
      `## Request context\n${markdown}\n\n` +
      `## Acceptance criteria\n` +
      `- The requested behavior is implemented and independently verified.\n\n` +
      `## Definition of done\n` +
      `The active guarana workflow reaches verification with recorded proof.\n`
  );

  return { specsDir, featureFile, created };
}
