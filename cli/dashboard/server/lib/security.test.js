import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { resolveAllowed } from './security.js';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

describe('resolveAllowed', () => {
  let tmp;
  let root;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-sec-'));
    root = path.join(tmp, 'root');
    fs.mkdirSync(path.join(root, 'sub'), { recursive: true });
    fs.writeFileSync(path.join(root, 'ok.md'), 'ok');
    fs.writeFileSync(path.join(root, 'sub', 'nested.md'), 'nested');
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('allows a file under a root', () => {
    const result = resolveAllowed('ok.md', [root], { requireExt: '.md' });
    assert.ok(result);
    assert.ok(result.realTarget.endsWith('ok.md'));
  });

  it('rejects traversal', () => {
    assert.equal(resolveAllowed('../outside.md', [root], { requireExt: '.md' }), null);
  });

  it('rejects absolute paths', () => {
    assert.equal(resolveAllowed('/etc/passwd', [root], { requireExt: '.md' }), null);
  });

  it('rejects wrong extension', () => {
    assert.equal(resolveAllowed('ok.txt', [root], { requireExt: '.md' }), null);
  });

  it('rejects missing files', () => {
    assert.equal(resolveAllowed('missing.md', [root], { requireExt: '.md' }), null);
  });
});
