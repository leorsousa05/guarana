'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { validateSpecs } = require('./specs-validator.js');

const STATUSES = ['SPECIFIED', 'TASKED', 'IMPLEMENTED', 'VALIDATED', 'SHIPPED'];
const START = '<!-- guarana:record:start -->';
const END = '<!-- guarana:record:end -->';

function recordSpecs(input, root) {
  const fail = (message) => { const error = new Error(message); error.invalid = true; throw error; };
  let data;
  try { data = JSON.parse(input); } catch { fail('invalid JSON'); }
  const t = data?.task;
  const structuralIssues = [];
  if (data?.schema !== 'v1') structuralIssues.push('schema expected "v1"');
  if (!t || typeof t !== 'object' || Array.isArray(t)) {
    structuralIssues.push('task expected object');
  } else {
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
  if (structuralIssues.length) fail(`schema v1 validation failed: ${structuralIssues.join('; ')}`);
  const relative = t.featurePath.replace(/\\/g, '/');
  if (path.posix.isAbsolute(relative) || relative.split('/').some((part) => !part || part === '.' || part === '..') || !/^\.specs\/features\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.md$/.test(relative) || t.slug !== path.posix.basename(relative, '.md')) fail('featurePath must be a safe .specs/features Markdown path matching slug');
  const changePath = typeof t.changePath === 'string' ? t.changePath.replace(/\\/g, '/') : t.changePath;
  if (t.changePath !== undefined && (typeof t.changePath !== 'string' || !/^\.specs\/changes\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.md$/.test(changePath))) fail('invalid changePath');
  if (t.status === 'VALIDATED' && !(t.verification?.independent === true && t.verification?.result === 'PASS' && t.verification?.verifier === 'worker-verify' && t.proof.some((v) => v.trim()))) fail('VALIDATED requires independent worker-verify PASS and proof');
  if (t.status === 'SHIPPED' && t.shipped !== true) fail('SHIPPED requires shipped: true');
  const unsafe = [t.title,t.trackerName,t.goal,...t.requirements,...t.assumptions,...t.scope,...t.acceptanceCriteria,...t.pendingWrites,...t.proof,...(t.currentStep === undefined ? [] : [t.currentStep]),t.next,changePath || ''];
  if (unsafe.some((v) => /[|\r\n]/.test(v))) fail('Markdown table delimiters or multiline fields are not allowed');
  const abs = (rel) => path.join(root, rel);
  const targets = [abs('.specs/README.md'),abs('.specs/state/project-state.md'),abs(relative)];
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
  const replaceSection = (text, heading, body) => {
    const re = new RegExp(`^##\\s+${heading}\\s*$`, 'im');
    const match = re.exec(text);
    if (!match) return `${text.trimEnd()}\n\n## ${heading}\n${body}\n`;
    const start = match.index + match[0].length;
    const next = /^##\s+/gm; next.lastIndex = start;
    const end = next.exec(text)?.index ?? text.length;
    return `${text.slice(0,start)}\n${body}\n\n${text.slice(end).replace(/^\s+/, '')}`;
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
  try {
    let tracker = old.get(targets[0]).toString('utf8');
    const row = `| ${t.trackerName} | ${t.status} | ${t.proof.join('; ')} | ${changePath || ''} |`;
    const rows = tracker.split('\n'); const found = rows.findIndex((line) => /^\|/.test(line) && line.split('|')[1]?.trim() === t.trackerName);
    if (found >= 0) rows[found] = row; else { const sep = rows.findIndex((line) => /^\|\s*:?-+/.test(line)); if (sep < 0) fail('malformed tracker table'); rows.splice(sep + 1,0,row); }
    tracker = rows.join('\n').replace(/^\*\*NEXT:\*\*.*$/m, `**NEXT:** ${t.next}`);
    fs.writeFileSync(targets[0],tracker);
    let state = old.get(targets[1]).toString('utf8');
    if (t.currentStep !== undefined) state = replaceSection(state, 'Current step', t.currentStep);
    state = replacePendingWrites(state, t.pendingWrites);
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
    const validation = validateSpecs(root);
    if (!validation.ok) throw new Error('validateSpecs failed');
    const changed = targets.filter((f) => old.get(f) === null || !old.get(f).equals(fs.readFileSync(f))).map((f)=>path.relative(root,f));
    return { ok:true, changed, validator:{ok:validation.ok,filesScanned:validation.filesScanned,issues:validation.issues} };
  } catch (error) {
    for (const [file, content] of old) { if (content === null) fs.rmSync(file,{force:true}); else fs.writeFileSync(file,content); }
    for (const dir of createdDirs.reverse()) fs.rmSync(dir,{recursive:true,force:true});
    throw error;
  }
}

module.exports = { recordSpecs };
