'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { validateSpecs } = require('./specs-validator.js');

const STATUSES = ['SPECIFIED', 'TASKED', 'IMPLEMENTED', 'VALIDATED', 'SHIPPED'];
const START = '<!-- guarana:record:start -->';
const END = '<!-- guarana:record:end -->';

function splitLines(bytes) {
  const lines = [];
  let start = 0;
  for (let index = 0; index < bytes.length; index += 1) {
    if (bytes[index] !== 0x0a && bytes[index] !== 0x0d) continue;
    const contentEnd = index;
    if (bytes[index] === 0x0d && bytes[index + 1] === 0x0a) index += 1;
    lines.push({ content: bytes.subarray(start, contentEnd), ending: bytes.subarray(contentEnd, index + 1) });
    start = index + 1;
  }
  if (start < bytes.length) lines.push({ content: bytes.subarray(start), ending: Buffer.alloc(0) });
  return lines;
}

function headingText(line) {
  const text = line.content.toString('utf8');
  if (!text.startsWith('## ') || text.startsWith('###')) return null;
  return text.slice(3).replace(/[ \t]+$/, '');
}

function projectStateMetadata(text) {
  const heading = /^# Project State[ \t]*(\r\n|\n|\r|$)/m.exec(text);
  if (!heading) throw new Error('project-state heading not found');
  const start = heading.index + heading[0].length;
  const sections = /^##\s+/gm;
  sections.lastIndex = start;
  return { heading, start, end: sections.exec(text)?.index ?? text.length };
}

function withoutProjectStateLastUpdated(text) {
  const { start, end } = projectStateMetadata(text);
  const metadata = text.slice(start, end);
  return text.slice(0, start) + metadata.replace(/^Last updated:[^\r\n]*$/m, '') + text.slice(end);
}

function setProjectStateLastUpdated(text, timestamp) {
  const { heading, start, end } = projectStateMetadata(text);
  const metadata = text.slice(start, end);
  const field = /^Last updated:[^\r\n]*$/m;
  if (field.test(metadata)) {
    return text.slice(0, start) + metadata.replace(field, `Last updated: ${timestamp}`) + text.slice(end);
  }

  const newline = heading[1] || (text.includes('\r\n') ? '\r\n' : text.includes('\r') ? '\r' : '\n');
  const insertion = heading[1]
    ? `Last updated: ${timestamp}${newline}`
    : `${newline}Last updated: ${timestamp}`;
  const headingEnd = heading.index + heading[0].length;
  return text.slice(0, headingEnd) + insertion + text.slice(headingEnd);
}

function updateKnownIssueStatuses(bytes, updates, fail) {
  const lines = splitLines(bytes);
  for (const { heading, status } of updates) {
    const matches = [];
    for (let index = 0; index < lines.length; index += 1) {
      if (headingText(lines[index]) === heading) matches.push(index);
    }
    if (matches.length === 0) fail('known-issue heading not found');
    if (matches.length !== 1) fail('known-issue heading is ambiguous');

    const start = matches[0];
    let end = lines.length;
    for (let index = start + 1; index < lines.length; index += 1) {
      if (headingText(lines[index]) !== null) { end = index; break; }
    }
    const statusLines = [];
    for (let index = start + 1; index < end; index += 1) {
      const text = lines[index].content.toString('utf8');
      if (/^[ \t]*-[ \t]+\*\*Status:\*\*[ \t]*.*[ \t]*$/.test(text)) statusLines.push(index);
    }
    if (statusLines.length === 0) fail('known-issue status bullet not found');

    const target = statusLines.at(-1);
    const text = lines[target].content.toString('utf8');
    const match = /^([ \t]*-[ \t]+\*\*Status:\*\*[ \t]*)(.*?)([ \t]*)$/.exec(text);
    const prefixLength = match[1].length;
    const suffixLength = match[3].length;
    const current = lines[target].content;
    lines[target] = {
      content: Buffer.concat([
        current.subarray(0, prefixLength),
        Buffer.from(status, 'utf8'),
        ...(suffixLength ? [current.subarray(current.length - suffixLength)] : []),
      ]),
      ending: lines[target].ending,
    };
  }
  return Buffer.concat(lines.flatMap(({ content, ending }) => [content, ending]));
}

function recordSpecs(input, root) {
  const fail = (message) => { const error = new Error(message); error.invalid = true; throw error; };
  let data;
  try { data = JSON.parse(input); } catch { fail('invalid JSON'); }
  const schema = data?.schema;
  const hasTask = data !== null && typeof data === 'object' && Object.hasOwn(data, 'task');
  if (schema === 'v1' && data !== null && typeof data === 'object' && Object.hasOwn(data, 'knownIssueStatusUpdates')) {
    fail('schema v1 does not support knownIssueStatusUpdates');
  }
  let knownIssueStatusUpdates = [];
  if (schema === 'v2') {
    if (!Array.isArray(data.knownIssueStatusUpdates) || data.knownIssueStatusUpdates.length === 0) {
      fail('schema v2 validation failed: knownIssueStatusUpdates expected non-empty array');
    }
    knownIssueStatusUpdates = data.knownIssueStatusUpdates;
    const submittedHeadings = new Set();
    const updateIssues = [];
    knownIssueStatusUpdates.forEach((update, index) => {
      if (!update || typeof update !== 'object' || Array.isArray(update)) {
        updateIssues.push(`knownIssueStatusUpdates[${index}] expected object`);
        return;
      }
      if (typeof update.heading !== 'string' || !update.heading.trim() || /[\r\n\u000b\u000c\u0085\u2028\u2029]/.test(update.heading)) {
        updateIssues.push(`knownIssueStatusUpdates[${index}].heading expected non-empty single-line string`);
      } else if (submittedHeadings.has(update.heading)) {
        updateIssues.push(`knownIssueStatusUpdates[${index}].heading must be unique`);
      } else {
        submittedHeadings.add(update.heading);
      }
      if (typeof update.status !== 'string' || !update.status.trim() || /[\r\n\u000b\u000c\u0085\u2028\u2029]/.test(update.status)) {
        updateIssues.push(`knownIssueStatusUpdates[${index}].status expected non-empty single-line string`);
      }
    });
    if (updateIssues.length) fail(`schema v2 validation failed: ${updateIssues.join('; ')}`);
  }

  const t = data?.task;
  const structuralIssues = [];
  if (schema !== 'v1' && schema !== 'v2') structuralIssues.push('schema expected "v1"');
  if (schema === 'v2' && !hasTask) {
    // A v2 envelope without task is the supported status-only form.
  } else if (!t || typeof t !== 'object' || Array.isArray(t)) {
    structuralIssues.push('task expected object');
  } else if (t) {
    // Keep diagnostics in the schema-v1 task-field order and never include submitted values.
    const checkString = (key) => {
      if (typeof t[key] !== 'string' || !t[key].trim()) structuralIssues.push(`task.${key} expected non-empty string`);
    };
    const checkStringArray = (key) => {
      if (!Array.isArray(t[key])) {
        structuralIssues.push(`task.${key} expected array of strings`);
        return;
      }
      t[key].forEach((value, index) => {
        if (typeof value !== 'string') structuralIssues.push(`task.${key}[${index}] expected string`);
      });
    };

    checkString('slug');
    checkString('title');
    checkString('featurePath');
    checkString('trackerName');
    if (t.removeTrackerNames !== undefined) {
      if (!Array.isArray(t.removeTrackerNames)) {
        structuralIssues.push('task.removeTrackerNames expected array of strings');
      } else {
        if (t.removeTrackerNames.length === 0) structuralIssues.push('task.removeTrackerNames expected non-empty array');
        t.removeTrackerNames.forEach((value, index) => {
          if (typeof value !== 'string') structuralIssues.push(`task.removeTrackerNames[${index}] expected string`);
          else if (!value.trim()) structuralIssues.push(`task.removeTrackerNames[${index}] expected non-empty string`);
        });
      }
    }
    if (!STATUSES.includes(t.status)) structuralIssues.push(`task.status expected one of ${STATUSES.join('|')}`);
    checkString('goal');
    checkStringArray('requirements');
    checkStringArray('assumptions');
    checkStringArray('scope');
    checkStringArray('acceptanceCriteria');
    if (t.currentStep !== undefined) checkString('currentStep');
    checkStringArray('pendingWrites');
    checkString('next');
    checkStringArray('proof');
  }
  if (structuralIssues.length) fail(`schema ${schema === 'v2' ? 'v2' : 'v1'} validation failed: ${structuralIssues.join('; ')}`);
  if (t && t.removeTrackerNames !== undefined) {
    if (new Set(t.removeTrackerNames).size !== t.removeTrackerNames.length) fail('task.removeTrackerNames must not contain duplicates');
    if (t.removeTrackerNames.includes(t.trackerName)) fail('task.removeTrackerNames must not include task.trackerName');
  }
  let relative;
  let changePath;
  if (t) {
    relative = t.featurePath.replace(/\\/g, '/');
    if (path.posix.isAbsolute(relative) || relative.split('/').some((part) => !part || part === '.' || part === '..') || !/^\.specs\/features\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.md$/.test(relative) || t.slug !== path.posix.basename(relative, '.md')) fail('featurePath must be a safe .specs/features Markdown path matching slug');
    changePath = typeof t.changePath === 'string' ? t.changePath.replace(/\\/g, '/') : t.changePath;
    if (t.changePath !== undefined && (typeof t.changePath !== 'string' || !/^\.specs\/changes\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.md$/.test(changePath))) fail('invalid changePath');
    if (t.status === 'VALIDATED' && !(t.verification?.independent === true && t.verification?.result === 'PASS' && t.verification?.verifier === 'worker-verify' && t.proof.some((v) => v.trim()))) fail('VALIDATED requires independent worker-verify PASS and proof');
    if (t.status === 'SHIPPED' && t.shipped !== true) fail('SHIPPED requires shipped: true');
    const unsafe = [t.title,t.trackerName,...(t.removeTrackerNames || []),t.goal,...t.requirements,...t.assumptions,...t.scope,...t.acceptanceCriteria,...t.pendingWrites,...t.proof,...(t.currentStep === undefined ? [] : [t.currentStep]),t.next,changePath || ''];
    if (unsafe.some((v) => /[|\r\n]/.test(v))) fail('Markdown table delimiters or multiline fields are not allowed');
  }
  const abs = (rel) => path.join(root, rel);
  const targets = t ? [abs('.specs/README.md'),abs('.specs/state/project-state.md'),abs(relative)] : [];
  const knownIssuesPath = abs('.specs/state/known-issues.md');
  if (schema === 'v2') targets.push(knownIssuesPath);
  for (const file of targets) { const rel = path.relative(root,file); if (rel.startsWith('..') || path.isAbsolute(rel)) fail('target escapes project root'); }
  const ensureContained = (file) => {
    const resolved = path.resolve(file);
    if (resolved !== root && !resolved.startsWith(`${path.resolve(root)}${path.sep}`)) fail('target escapes project root');
    let current = path.resolve(root);
    for (const part of path.relative(current, path.dirname(file)).split(path.sep)) { if (!part || part === '.') continue; current = path.join(current,part); if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) fail('symlink target is not allowed'); }
    if (fs.existsSync(file) && fs.lstatSync(file).isSymbolicLink()) fail('symlink target is not allowed');
  };
  for (const file of targets) ensureContained(file);
  const old = new Map(targets.map((f) => [f, fs.existsSync(f) ? fs.readFileSync(f) : null]));
  let updatedKnownIssues;
  if (schema === 'v2') {
    const original = old.get(knownIssuesPath);
    if (original === null) fail('known-issues.md not found');
    updatedKnownIssues = updateKnownIssueStatuses(original, knownIssueStatusUpdates, fail);
  }
  const replaceSection = (text, heading, body) => {
    const newline = text.match(/\r\n|\r|\n/)?.[0] || '\n';
    const re = new RegExp(`^##[ \\t]+${heading}[ \\t]*$`, 'im');
    const match = re.exec(text);
    if (!match) {
      const trailingNewlines = text.match(/(?:\r\n|\r|\n)*$/)[0].match(/\r\n|\r|\n/g)?.length || 0;
      return `${text}${newline.repeat(Math.max(0, 2 - trailingNewlines))}## ${heading}${newline}${body}${newline}`;
    }
    const start = match.index + match[0].length;
    const next = /^##\s+/gm; next.lastIndex = start;
    const end = next.exec(text)?.index ?? text.length;
    return `${text.slice(0,start)}${newline}${body}${newline}${newline}${text.slice(end).replace(/^\s+/, '')}`;
  };
  const replacePendingWrites = (text, pendingWrites) => {
    const heading = /^##\s+Checkpoint\s*$/im.exec(text);
    if (!heading) return text;
    const start = heading.index + heading[0].length;
    const next = /^##\s+/gm; next.lastIndex = start;
    const end = next.exec(text)?.index ?? text.length;
    const body = text.slice(start, end);
    const value = pendingWrites.length ? pendingWrites.join('; ') : 'none.';
    const line = /^([ \t]*-[ \t]*Pending writes:[ \t]*)[^\r\n]*(\r?)$/im;
    if (line.test(body)) {
      return `${text.slice(0, start)}${body.replace(line, (_match, prefix, carriageReturn) => `${prefix}${value}${carriageReturn}`)}${text.slice(end)}`;
    }
    const trailingWhitespace = body.match(/(?:\r?\n[ \t]*)*$/)[0];
    const checkpointContent = body.slice(0, body.length - trailingWhitespace.length);
    const newline = body.includes('\r\n') ? '\r\n' : '\n';
    const updated = `${checkpointContent}${newline}- Pending writes: ${value}${trailingWhitespace}`;
    return `${text.slice(0, start)}${updated}${text.slice(end)}`;
  };
  const createdDirs = [];
  let removedTrackerNames = [];
  try {
    if (t) {
      let tracker = old.get(targets[0]).toString('utf8');
      const rows = tracker.split('\n');
      if (t.removeTrackerNames !== undefined) {
        const masterHeading = rows.findIndex((line) => /^##\s+Master tracker\s*$/i.test(line));
        const sectionEnd = rows.findIndex((line, index) => index > masterHeading && /^##\s+/.test(line));
        const masterEnd = sectionEnd < 0 ? rows.length : sectionEnd;
        const header = rows.findIndex((line, index) => index > masterHeading && index < masterEnd && /^\|\s*(?:Skill|Name)\s*\|\s*Status\s*\|/i.test(line));
        const separator = header >= 0 && /^\|\s*:?-{3,}/.test(rows[header + 1] || '') ? header + 1 : -1;
        if (masterHeading < 0 || header < 0 || separator < 0) fail('malformed tracker table');
        const namesToRemove = new Set(t.removeTrackerNames);
        const matchingRows = new Set();
        const matchedNames = new Set();
        for (let index = separator + 1; index < masterEnd && /^\s*\|/.test(rows[index]); index += 1) {
          const name = rows[index].split('|')[1]?.trim();
          if (namesToRemove.has(name)) {
            matchingRows.add(index);
            matchedNames.add(name);
          }
        }
        removedTrackerNames = t.removeTrackerNames.filter((name) => matchedNames.has(name));
        for (const index of [...matchingRows].sort((left, right) => right - left)) rows.splice(index, 1);
      }
      const row = `| ${t.trackerName} | ${t.status} | ${t.proof.join('; ')} | ${changePath || ''} |`;
      const found = rows.findIndex((line) => /^\|/.test(line) && line.split('|')[1]?.trim() === t.trackerName);
      if (found >= 0) rows[found] = row; else { const sep = rows.findIndex((line) => /^\|\s*:?-+/.test(line)); if (sep < 0) fail('malformed tracker table'); rows.splice(sep + 1,0,row); }
      tracker = rows.join('\n').replace(/^\*\*NEXT:\*\*.*$/m, `**NEXT:** ${t.next}`);
      fs.writeFileSync(targets[0],tracker);
      const originalState = old.get(targets[1]).toString('utf8');
      let state = originalState;
      if (t.currentStep !== undefined) state = replaceSection(state, 'Current step', t.currentStep);
      state = replacePendingWrites(state, t.pendingWrites);
      if (withoutProjectStateLastUpdated(state) !== withoutProjectStateLastUpdated(originalState)) {
        state = setProjectStateLastUpdated(state, new Date().toISOString());
      }
      fs.writeFileSync(targets[1],state);
      const originalFeature = old.get(targets[2]);
      let feature = originalFeature === null ? null : originalFeature.toString('utf8');
      if (feature === null) feature = `# Feature spec: ${t.title}\n\n**Status: ${t.status}**\n\n## Goal\n${t.goal}\n\n## Requirements\n${t.requirements.map((x)=>`- ${x}`).join('\n') || '- None supplied'}\n\n## Assumptions and scope\n${[...t.assumptions,...t.scope].map((x)=>`- ${x}`).join('\n') || '- None supplied'}\n\n## Acceptance criteria\n${t.acceptanceCriteria.map((x,i)=>`${i+1}. ${x}`).join('\n')}\n`;
      else feature = feature.replace(/^\*\*Status:\*\*\s*[^\r\n]+$|^\*\*Status:\s*[^*]+\*\*$/m, `**Status: ${t.status}**`);
      const receipt = `${START}\nStatus: ${t.status}\nProof: ${t.proof.join('; ') || 'none'}\nChange: ${changePath || 'none'}\n${END}`;
      const markers = new RegExp(`${START}[\\s\\S]*?${END}`);
      feature = markers.test(feature) ? feature.replace(markers,receipt) : `${feature.trimEnd()}\n\n${receipt}\n`;
      const parent = path.dirname(targets[2]);
      const missing = []; for (let dir = parent; !fs.existsSync(dir); dir = path.dirname(dir)) missing.push(dir);
      for (const dir of missing.reverse()) { fs.mkdirSync(dir); createdDirs.push(dir); }
      fs.writeFileSync(targets[2],feature);
    }
    if (schema === 'v2' && !old.get(knownIssuesPath).equals(updatedKnownIssues)) {
      fs.writeFileSync(knownIssuesPath, updatedKnownIssues);
    }
    const validation = validateSpecs(root);
    if (!validation.ok) throw new Error('validateSpecs failed');
    const changed = targets.filter((f) => old.get(f) === null || !old.get(f).equals(fs.readFileSync(f))).map((f)=>path.relative(root,f));
    return { ok:true, changed, ...(t && t.removeTrackerNames !== undefined ? { removedTrackerNames } : {}), ...(schema === 'v2' ? { updatedKnownIssueHeadings: knownIssueStatusUpdates.map(({ heading }) => heading) } : {}), validator:{ok:validation.ok,filesScanned:validation.filesScanned,issues:validation.issues} };
  } catch (error) {
    for (const [file, content] of old) { if (content === null) fs.rmSync(file,{force:true}); else fs.writeFileSync(file,content); }
    for (const dir of createdDirs.reverse()) fs.rmSync(dir,{recursive:true,force:true});
    throw error;
  }
}

module.exports = { recordSpecs };
