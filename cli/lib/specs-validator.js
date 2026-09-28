'use strict';

const fs = require('node:fs');
const path = require('node:path');

function markdownFiles(dir, prefix = '') {
  try {
    if (!fs.statSync(dir).isDirectory()) return [];
  } catch {
    return [];
  }
  const files = [];
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return []; }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...markdownFiles(full, rel));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) files.push(rel);
  }
  return files.sort();
}

function stripCode(markdown) {
  return markdown
    .replace(/```[\s\S]*?```/g, '')
    .replace(/~~~[\s\S]*?~~~/g, '')
    .replace(/`[^`]*`/g, '');
}

function featureSpecFiles(files) {
  return files.filter((file) => {
    const normalized = file.replace(/\\/g, '/');
    const base = path.posix.basename(normalized).toLowerCase();
    return normalized.startsWith('features/') &&
      !normalized.includes('/proofs/') &&
      !normalized.includes('/audits/') &&
      base !== 'overview.md';
  });
}

function sectionBody(markdown, titlePattern) {
  const headings = [...markdown.matchAll(/^##\s+(.+?)\s*$/gm)];
  const index = headings.findIndex((heading) => titlePattern.test(heading[1]));
  if (index === -1) return null;
  const start = headings[index].index + headings[index][0].length;
  const end = headings[index + 1]?.index ?? markdown.length;
  return markdown.slice(start, end).trim();
}

function validateSpecs(projectRoot) {
  const root = path.resolve(projectRoot || process.cwd());
  const specsDir = path.join(root, '.specs');
  const issues = [];
  const add = (severity, file, message, code) => {
    issues.push({ severity, file: file || '.specs', code, message });
  };
  const read = (file) => {
    try {
      return fs.readFileSync(file, 'utf8');
    } catch {
      return null;
    }
  };

  let specsIsDirectory = false;
  try { specsIsDirectory = fs.statSync(specsDir).isDirectory(); } catch { /* handled below */ }
  if (!specsIsDirectory) {
    add('error', '.specs', 'Missing project .specs/ directory.', 'missing-specs-dir');
    return { ok: false, root, filesScanned: 0, featureSpecs: 0, issues };
  }

  const files = markdownFiles(specsDir);
  const fileSet = new Set(files);
  const required = [
    ['README.md', 'Master specs tracker is missing.', false],
    ['state/project-state.md', 'Project state/checkpoint is missing.', false],
    ['decisions', 'Decision directory is missing.', true],
    ['features', 'Feature-spec directory is missing.', true],
  ];

  for (const [target, message, directory] of required) {
    const full = path.join(specsDir, target);
    if (!fs.existsSync(full)) add('error', `.specs/${target}`, message, 'missing-required-path');
    else if (directory && !fs.statSync(full).isDirectory()) add('error', `.specs/${target}`, `${target} must be a directory.`, 'invalid-required-path-type');
  }

  const trackerPath = path.join(specsDir, 'README.md');
  const tracker = read(trackerPath);
  if (tracker === null && fs.existsSync(trackerPath)) {
    add('error', '.specs/README.md', 'Tracker file is not readable.', 'unreadable-tracker');
  }
  if (tracker !== null) {
    if (!/^##\s+Master tracker\s*$/im.test(tracker)) {
      add('error', '.specs/README.md', 'Tracker must have a "## Master tracker" heading.', 'tracker-heading');
    }
    if (!/^\|\s*(?:Skill|Name)\s*\|\s*Status\s*\|/im.test(tracker)) {
      add('error', '.specs/README.md', 'Tracker table must start with Skill or Name and Status columns.', 'tracker-table');
    } else {
      const dataRows = tracker.split('\n').filter((line) => /^\|/.test(line.trim()) && !/^\|\s*:?-{3,}/.test(line.trim()));
      if (dataRows.length < 2) add('error', '.specs/README.md', 'Tracker table must contain at least one project row.', 'tracker-empty');
    }
    for (const flag of ['DONE', 'NEXT', 'BLOCKED']) {
      if (!new RegExp(`^\\*\\*${flag}:\\*\\*`, 'im').test(tracker)) {
        add('error', '.specs/README.md', `Tracker is missing the **${flag}:** flag.`, 'tracker-flag');
      }
    }
  }

  const statePath = path.join(specsDir, 'state', 'project-state.md');
  const state = read(statePath);
  if (state === null && fs.existsSync(statePath)) {
    add('error', '.specs/state/project-state.md', 'Project state file is not readable.', 'unreadable-state');
  }
  if (state !== null) {
    for (const heading of ['Current step', 'Checkpoint']) {
      if (!new RegExp(`^##\\s+${heading}\\s*$`, 'im').test(state)) {
        add('error', '.specs/state/project-state.md', `Project state is missing "## ${heading}".`, 'state-heading');
      }
    }
    if (!/^\s*-\s*Goal:\s*\S/im.test(state)) {
      add('error', '.specs/state/project-state.md', 'Checkpoint must include a non-empty "- Goal:" line.', 'state-goal');
    }
  }

  const features = featureSpecFiles(files);
  if (!features.length) {
    add('error', '.specs/features', 'No feature specification Markdown files were found.', 'no-feature-specs');
  }
  for (const file of features) {
    const content = read(path.join(specsDir, file));
    const shortFile = `.specs/${file}`;
    if (content === null) {
      add('error', shortFile, 'Feature spec is not readable.', 'unreadable-feature');
      continue;
    }
    if (!/^#\s+(?:Feature spec\s*:|Feature\s*\/)/im.test(content)) {
      add('warning', shortFile, 'Feature document has no recognized feature title heading.', 'feature-title');
    }
    if (!/^##\s+(?:Goal|Summary)\b/im.test(content)) {
      add('error', shortFile, 'Feature spec must describe its goal or summary.', 'feature-goal');
    }
    const acceptance = sectionBody(content, /^(?:Acceptance(?:\s+criteria)?|Verifiable condition)\b/i);
    if (!acceptance || !/^\s*(?:[-*+]\s+|\d+\.\s+)\S/m.test(acceptance)) {
      add('error', shortFile, 'Feature spec must contain at least one acceptance criterion or verifiable condition.', 'feature-acceptance');
    }
  }

  const adrNumbers = new Map();
  const decisionFiles = files.filter((file) => file.startsWith('decisions/'));
  for (const file of decisionFiles) {
    const match = path.posix.basename(file).match(/^ADR-(\d{3})-.+\.md$/);
    const content = read(path.join(specsDir, file));
    const shortFile = `.specs/${file}`;
    if (!match) {
      add('error', shortFile, 'Decision file must be named ADR-NNN-short-title.md.', 'adr-filename');
      continue;
    }
    if (adrNumbers.has(match[1])) {
      add('error', shortFile, `Duplicate ADR number ${match[1]} (also used by ${adrNumbers.get(match[1])}).`, 'adr-duplicate');
    } else {
      adrNumbers.set(match[1], shortFile);
    }
    if (content === null) continue;
    if (!new RegExp(`^#\\s+ADR-${match[1]}\\b`, 'im').test(content)) {
      add('error', shortFile, `Heading must begin with "# ADR-${match[1]}".`, 'adr-heading');
    }
    if (!/^\*\*Status:\*\*\s*\S/im.test(content)) {
      add('error', shortFile, 'Decision record must declare **Status:**.', 'adr-status');
    }
    if (!/^##\s+Decision\s*$/im.test(content)) {
      add('error', shortFile, 'Decision record must contain a "## Decision" section.', 'adr-decision');
    } else if (!sectionBody(content, /^Decision$/i)) {
      add('error', shortFile, 'Decision section must contain a decision statement.', 'adr-empty-decision');
    }
  }

  let linksChecked = 0;
  for (const file of files) {
    const source = path.join(specsDir, file);
    const content = read(source);
    if (content === null) continue;
    const markdown = stripCode(content);
    const linkPattern = /!?\[[^\]]*\]\((<[^>]+>|[^)]+)\)/g;
    let match;
    while ((match = linkPattern.exec(markdown))) {
      let target = match[1].trim();
      if (target.startsWith('<') && target.endsWith('>')) target = target.slice(1, -1);
      target = target.replace(/\s+["'][^"']*["']$/, '').trim();
      if (!target || /^(?:https?:|mailto:|tel:|\/\/)/i.test(target) || target.startsWith('#')) continue;
      let decoded;
      try { decoded = decodeURIComponent(target); } catch { decoded = target; }
      const pathPart = decoded.split(/[?#]/, 1)[0];
      if (!pathPart) continue;
      linksChecked += 1;
      const resolved = path.resolve(path.dirname(source), pathPart);
      const relative = path.relative(root, resolved);
      if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
        add('error', `.specs/${file}`, `Link escapes the project root: ${target}`, 'link-escapes-root');
      } else if (!fs.existsSync(resolved)) {
        add('error', `.specs/${file}`, `Broken local link: ${target}`, 'broken-link');
      }
    }
  }

  const errors = issues.filter((issue) => issue.severity === 'error').length;
  return {
    ok: errors === 0,
    root,
    filesScanned: fileSet.size,
    featureSpecs: features.length,
    adrs: decisionFiles.length,
    linksChecked,
    issues,
  };
}

module.exports = { validateSpecs };
