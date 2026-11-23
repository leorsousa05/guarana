'use strict';

const path = require('node:path');
const fs = require('node:fs');
const { validateSpecs } = require('../lib/specs-validator.js');
const { MAX_HANDOFF_BYTES, recordSpecs } = require('../lib/spec-record.js');
const { TextDecoder } = require('node:util');
const { SPECS, renderDetailedHelp } = require('../command-metadata.js');
const { stdoutLine, stderrLine, writeStdout } = require('../lib/io.js');

const HELP = renderDetailedHelp(SPECS);
const RECORD_USAGE = 'usage: guarana specs record --stdin | --file .specs/state/worker-specs-handoff.json';
const VALIDATE_USAGE = 'usage: guarana specs validate [project-root] [--json]';
const HANDOFF_FILE = '.specs/state/worker-specs-handoff.json';

function readBounded(fd) {
  const chunks = [];
  const buffer = Buffer.alloc(8192);
  let total = 0;
  while (true) {
    const bytesRead = fs.readSync(fd, buffer, 0, Math.min(buffer.length, MAX_HANDOFF_BYTES + 1 - total), null);
    if (bytesRead === 0) break;
    total += bytesRead;
    if (total > MAX_HANDOFF_BYTES) throw new Error(`handoff exceeds ${MAX_HANDOFF_BYTES} byte limit`);
    chunks.push(Buffer.from(buffer.subarray(0, bytesRead)));
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, total));
  } catch {
    throw new Error('handoff must be valid UTF-8');
  }
}

function lstatIfPresent(file) {
  try {
    return fs.lstatSync(file);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function parseSpecsArgs(args = []) {
  const [sub, ...rest] = args;
  if (args.length === 0 || sub === '--help' || sub === '-h') return { type: 'help' };
  if (sub === 'record') {
    if (rest.length === 1 && rest[0] === '--stdin') return { type: 'record', source: 'stdin' };
    if (rest.length === 2 && rest[0] === '--file') {
      if (rest[1] !== HANDOFF_FILE) return { type: 'record-error', message: `file must be ${HANDOFF_FILE}` };
      return { type: 'record', source: 'file', file: HANDOFF_FILE };
    }
    return { type: 'record-error', message: RECORD_USAGE };
  }
  if (sub !== 'validate') return { type: 'unknown', subcommand: sub };

  const json = rest.includes('--json');
  const roots = rest.filter((arg) => arg !== '--json');
  if (roots.length > 1) return { type: 'validate-error', message: VALIDATE_USAGE };
  return { type: 'validate', projectRoot: roots[0] || null, json };
}

function run(args, context = {}) {
  const parsed = parseSpecsArgs(args);
  if (parsed.type === 'help') {
    writeStdout(context, HELP);
    return 0;
  }
  if (parsed.type === 'unknown') {
    stderrLine(context, `unknown specs command: ${parsed.subcommand || '(missing)'}`);
    writeStdout(context, HELP);
    return 1;
  }
  if (parsed.type === 'validate-error') {
    stderrLine(context, parsed.message);
    return 1;
  }
  if (parsed.type === 'record-error') {
    stdoutLine(context, JSON.stringify({ok:false,changed:[],error:parsed.message,validator:null}));
    return 1;
  }
  if (parsed.type === 'record') {
    let handoffFile;
    let handoffFd;
    let handoffIdentity;
    try {
      let input;
      if (parsed.source === 'stdin') input = readBounded(0);
      else {
        const root = process.cwd();
        const candidate = path.join(root, parsed.file);
        let current = root;
        for (const part of ['.specs','state']) {
          current = path.join(current, part);
          if (lstatIfPresent(current)?.isSymbolicLink()) throw new Error('symlink path is not allowed');
        }
        const stat = fs.lstatSync(candidate);
        if (stat.isSymbolicLink() || !stat.isFile()) throw new Error('handoff must be a regular file');
        handoffFd = fs.openSync(candidate, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
        const opened = fs.fstatSync(handoffFd);
        if (!opened.isFile() || opened.dev !== stat.dev || opened.ino !== stat.ino) {
          throw new Error('handoff changed while opening');
        }
        handoffFile = candidate;
        handoffIdentity = { dev: opened.dev, ino: opened.ino };
        input = readBounded(handoffFd);
      }
      stdoutLine(context, JSON.stringify(recordSpecs(input,process.cwd())));
    } catch (error) { stdoutLine(context, JSON.stringify({ok:false,changed:[],error:error.message,validator:null})); return 1; }
    finally {
      if (handoffFd !== undefined) {
        try { fs.closeSync(handoffFd); } catch { /* preserve the command result */ }
      }
      if (handoffFile) {
        try {
          const current = fs.lstatSync(handoffFile);
          if (current.isFile() && current.dev === handoffIdentity.dev && current.ino === handoffIdentity.ino) {
            fs.unlinkSync(handoffFile);
          }
        } catch (error) { if (error.code !== 'ENOENT') { /* preserve command result */ } }
      }
    }
    return 0;
  }

  const result = validateSpecs(path.resolve(parsed.projectRoot || process.cwd()));
  if (parsed.json) {
    stdoutLine(context, JSON.stringify(result, null, 2));
  } else {
    stdoutLine(context, `Validating specs: ${path.join(result.root, '.specs')}`);
    stdoutLine(context, `${result.filesScanned} Markdown file(s), ${result.featureSpecs} feature spec(s), ${result.adrs} ADR(s), ${result.linksChecked} local link(s)`);
    for (const issue of result.issues) {
      const location = issue.file ? `${issue.file}: ` : '';
      stdoutLine(context, `${issue.severity.toUpperCase()} ${location}${issue.message}`);
    }
    if (result.ok) stdoutLine(context, 'PASS: specs structure and local references are consistent.');
    else stdoutLine(context, `FAIL: ${result.issues.filter((issue) => issue.severity === 'error').length} error(s), ${result.issues.filter((issue) => issue.severity === 'warning').length} warning(s).`);
  }
  return result.ok ? 0 : 1;
}

module.exports = { run, HELP, parseSpecsArgs };
