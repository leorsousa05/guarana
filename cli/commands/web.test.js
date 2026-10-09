const { it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const web = require('./web.js');

function fixture(withModules = true, withEncodings = true) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-web-'));
  fs.writeFileSync(path.join(dir, 'index.js'), '');
  if (withModules) {
    const modules = path.join(dir, 'node_modules');
    fs.mkdirSync(path.join(modules, 'express'), { recursive: true });
    fs.writeFileSync(path.join(modules, 'express', 'index.js'), 'module.exports = {};');
    const iconv = path.join(modules, 'iconv-lite');
    fs.mkdirSync(iconv, { recursive: true });
    fs.writeFileSync(path.join(iconv, 'index.js'), `exports.getDecoder = () => require('./${withEncodings ? 'encodings' : 'missing'}');`);
    if (withEncodings) fs.writeFileSync(path.join(iconv, 'encodings.js'), 'module.exports = {};');
  }
  return dir;
}

it('skips install for healthy dashboard dependencies', () => {
  const dir = fixture();
  try {
    let installs = 0;
    assert.equal(web.ensureDependencies(dir, () => { installs++; }), true);
    assert.equal(installs, 0);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

it('runs exactly npm ci --omit=dev for missing and incomplete dependencies', () => {
  for (const dir of [fixture(false), fixture(true, false)]) {
    try {
      let calls = 0;
      assert.equal(web.ensureDependencies(dir, (command, args, options) => {
        calls++;
        assert.equal(command, 'npm');
        assert.deepEqual(args, ['ci', '--omit=dev']);
        assert.equal(options.cwd, dir);
        return { status: 1 };
      }), false);
      assert.equal(calls, 1);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
});

it('allows startup after post-install repair passes the readiness probe', () => {
  const dir = fixture(false);
  try {
    assert.equal(web.ensureDependencies(dir, () => {
      const modules = path.join(dir, 'node_modules');
      fs.mkdirSync(path.join(modules, 'express'), { recursive: true });
      fs.writeFileSync(path.join(modules, 'express', 'index.js'), 'module.exports = {};');
      const iconv = path.join(modules, 'iconv-lite');
      fs.mkdirSync(iconv, { recursive: true });
      fs.writeFileSync(path.join(iconv, 'index.js'), "exports.getDecoder = () => require('./encodings');");
      fs.writeFileSync(path.join(iconv, 'encodings.js'), 'module.exports = {};');
      return { status: 0 };
    }), true);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

it('returns failure when repair does not produce a healthy dependency tree', () => {
  const dir = fixture(true, false);
  try {
    assert.equal(web.ensureDependencies(dir, () => ({ status: 0 })), false);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
