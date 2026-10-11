'use strict';

const { it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { run } = require('./artifact-transaction.js');

it('refuses to follow a changed symlink during rollback and reports the rollback failure', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-transaction-symlink-'));
  const managed = path.join(temp, 'managed');
  const outside = path.join(temp, 'outside');
  const target = path.join(managed, 'profile.md');
  const outsideTarget = path.join(outside, 'profile.md');
  fs.mkdirSync(managed);
  fs.mkdirSync(outside);
  fs.writeFileSync(target, 'managed original\n');
  fs.writeFileSync(outsideTarget, 'foreign original\n');
  try {
    assert.throws(() => run([target], () => {
      fs.unlinkSync(target);
      fs.rmdirSync(managed);
      fs.symlinkSync(outside, managed, 'dir');
      throw new Error('original operation failure');
    }), (error) => {
      assert.match(error.message, /original operation failure; rollback failed/);
      assert.equal(error.cause.message, 'original operation failure');
      return true;
    });
    assert.equal(fs.readFileSync(outsideTarget, 'utf8'), 'foreign original\n');
    assert.ok(fs.lstatSync(managed).isSymbolicLink());
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
