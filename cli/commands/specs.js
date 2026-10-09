'use strict';

const path = require('node:path');
const fs = require('node:fs');
const { validateSpecs } = require('../lib/specs-validator.js');

const HELP = `guarana specs — deterministic .specs validation and record updates

Usage:
  guarana specs validate [project-root] [--json]
    Check required files, tracker/state structure, feature acceptance sections,
    ADR format, and local Markdown links. Exit code is 1 when errors are found.
  guarana specs record --stdin
    Read a schema v1 JSON handoff and transactionally update .specs records.
  guarana specs record --file .specs/state/worker-specs-handoff.json
    Read and remove the fixed schema v1 JSON handoff file.
`;

const STATUSES = ['SPECIFIED', 'TASKED', 'IMPLEMENTED', 'VALIDATED', 'SHIPPED'];
const START = '<!-- guarana:record:start -->';
const END = '<!-- guarana:record:end -->';

function record(input, root) {
  const fail = (message) => { const error = new Error(message); error.invalid = true; throw error; };
  let data;
  try { data = JSON.parse(input); } catch { fail('invalid JSON'); }
  const t = data?.task;
  const strings = ['slug','title','featurePath','trackerName','goal','currentStep','next'];
  if (data?.schema !== 'v1' || !t || strings.some((k) => typeof t[k] !== 'string' || !t[k].trim()) ||
      !STATUSES.includes(t.status) || ['requirements','assumptions','scope','acceptanceCriteria','pendingWrites','proof'].some((k) => !Array.isArray(t[k]) || t[k].some((v) => typeof v !== 'string')))
    fail('schema v1 required fields or enums are invalid');
  const relative = t.featurePath.replace(/\\/g, '/');
  if (path.posix.isAbsolute(relative) || relative.split('/').some((part) => !part || part === '.' || part === '..') || !/^\.specs\/features\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.md$/.test(relative) || t.slug !== path.posix.basename(relative, '.md')) fail('featurePath must be a safe .specs/features Markdown path matching slug');
  if (t.changePath !== undefined && (typeof t.changePath !== 'string' || !/^\.specs\/changes\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.md$/.test(t.changePath.replace(/\\/g,'/')))) fail('invalid changePath');
  if (t.status === 'VALIDATED' && !(t.verification?.independent === true && t.verification?.result === 'PASS' && t.verification?.verifier === 'worker-verify' && t.proof.some((v) => v.trim()))) fail('VALIDATED requires independent worker-verify PASS and proof');
  if (t.status === 'SHIPPED' && t.shipped !== true) fail('SHIPPED requires shipped: true');
  const unsafe = [t.title,t.trackerName,t.goal,...t.requirements,...t.assumptions,...t.scope,...t.acceptanceCriteria,...t.pendingWrites,...t.proof,t.currentStep,t.next,t.changePath || ''];
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
  const createdDirs = [];
  try {
    let tracker = old.get(targets[0]).toString('utf8');
    const row = `| ${t.trackerName} | ${t.status} | ${t.proof.join('; ')} | ${t.changePath || ''} |`;
    const rows = tracker.split('\n'); const found = rows.findIndex((line) => /^\|/.test(line) && line.split('|')[1]?.trim() === t.trackerName);
    if (found >= 0) rows[found] = row; else { const sep = rows.findIndex((line) => /^\|\s*:?-+/.test(line)); if (sep < 0) fail('malformed tracker table'); rows.splice(sep + 1,0,row); }
    tracker = rows.join('\n').replace(/^\*\*NEXT:\*\*.*$/m, `**NEXT:** ${t.next}`);
    fs.writeFileSync(targets[0],tracker);
    let state = old.get(targets[1]).toString('utf8');
    state = replaceSection(state, 'Current step', t.currentStep);
    fs.writeFileSync(targets[1],state);
    const originalFeature = old.get(targets[2]);
    let feature = originalFeature === null ? null : originalFeature.toString('utf8');
    if (feature === null) feature = `# Feature spec: ${t.title}\n\n**Status: ${t.status}**\n\n## Goal\n${t.goal}\n\n## Requirements\n${t.requirements.map((x)=>`- ${x}`).join('\n') || '- None supplied'}\n\n## Assumptions and scope\n${[...t.assumptions,...t.scope].map((x)=>`- ${x}`).join('\n') || '- None supplied'}\n\n## Acceptance criteria\n${t.acceptanceCriteria.map((x,i)=>`${i+1}. ${x}`).join('\n')}\n`;
    else feature = feature.replace(/^\*\*Status:\*\*\s*[^\r\n]+$|^\*\*Status:\s*[^*]+\*\*$/m, `**Status: ${t.status}**`);
    const receipt = `${START}\nStatus: ${t.status}\nProof: ${t.proof.join('; ') || 'none'}\nChange: ${t.changePath || 'none'}\n${END}`;
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

function run(args) {
  const [sub, ...rest] = args;
  if (sub === '--help' || sub === '-h') {
    process.stdout.write(HELP);
    return;
  }
  if (sub === 'record') {
    let handoffFile;
    try {
      let input;
      if (rest.length === 1 && rest[0] === '--stdin') input = fs.readFileSync(0,'utf8');
      else if (rest.length === 2 && rest[0] === '--file') {
        if (rest[1] !== '.specs/state/worker-specs-handoff.json') throw new Error('file must be .specs/state/worker-specs-handoff.json');
        const root = process.cwd();
        const candidate = path.join(root, '.specs/state/worker-specs-handoff.json');
        let current = root;
        for (const part of ['.specs','state']) {
          current = path.join(current, part);
          if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) throw new Error('symlink path is not allowed');
        }
        const stat = fs.lstatSync(candidate);
        if (stat.isSymbolicLink() || !stat.isFile()) throw new Error('handoff must be a regular file');
        handoffFile = candidate;
        input = fs.readFileSync(handoffFile, 'utf8');
      } else throw new Error('usage: guarana specs record --stdin | --file .specs/state/worker-specs-handoff.json');
      console.log(JSON.stringify(record(input,process.cwd())));
    } catch (error) { console.log(JSON.stringify({ok:false,changed:[],error:error.message,validator:null})); process.exitCode=1; }
    finally {
      if (handoffFile) {
        try { if (fs.lstatSync(handoffFile).isFile()) fs.unlinkSync(handoffFile); } catch (error) { if (error.code !== 'ENOENT') { /* preserve command result */ } }
      }
    }
    return;
  }
  if (sub !== 'validate') {
    console.error(`unknown specs command: ${sub || '(missing)'}`);
    process.stdout.write(HELP);
    process.exitCode = 1;
    return;
  }

  const json = rest.includes('--json');
  const roots = rest.filter((arg) => arg !== '--json');
  if (roots.length > 1) {
    console.error('usage: guarana specs validate [project-root] [--json]');
    process.exitCode = 1;
    return;
  }
  const result = validateSpecs(path.resolve(roots[0] || process.cwd()));
  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`Validating specs: ${path.join(result.root, '.specs')}`);
    console.log(`${result.filesScanned} Markdown file(s), ${result.featureSpecs} feature spec(s), ${result.adrs} ADR(s), ${result.linksChecked} local link(s)`);
    for (const issue of result.issues) {
      const location = issue.file ? `${issue.file}: ` : '';
      console.log(`${issue.severity.toUpperCase()} ${location}${issue.message}`);
    }
    if (result.ok) console.log('PASS: specs structure and local references are consistent.');
    else console.log(`FAIL: ${result.issues.filter((issue) => issue.severity === 'error').length} error(s), ${result.issues.filter((issue) => issue.severity === 'warning').length} warning(s).`);
  }
  if (!result.ok) process.exitCode = 1;
}

module.exports = { run, HELP };
