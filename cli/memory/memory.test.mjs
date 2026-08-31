import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import {
  initVault,
  projectVaultDir,
  loadConfig,
  exportVault,
  importVault,
  paths,
  readJsonl,
  writeJsonl,
} from "./vault.js";
import {
  addNode,
  createNode,
  getNode,
  updateNode,
  listNodes,
  addEdge,
  createEdge,
  listEdges,
  MemoryValidationError,
} from "./graph.js";
import { searchVault } from "./search.js";
import { isSensitive, sanitize } from "./security.js";
import { captureAtom, projectHashFor } from "./capture.js";

let tmpDir;
let vaultDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "guarana-memory-"));
  vaultDir = initVault(tmpDir);
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("vault lifecycle", () => {
  it("init creates dirs/files and gitignore entry, idempotently", () => {
    assert.equal(vaultDir, projectVaultDir(tmpDir));
    assert.ok(fs.existsSync(paths(vaultDir).nodes));
    assert.ok(fs.existsSync(paths(vaultDir).edges));
    assert.ok(fs.existsSync(paths(vaultDir).config));
    assert.ok(fs.existsSync(paths(vaultDir).drafts));
    const gi = fs.readFileSync(path.join(tmpDir, ".gitignore"), "utf8");
    assert.ok(gi.split("\n").includes(".guarana/memory/"));
    initVault(tmpDir); // idempotent
    const gi2 = fs.readFileSync(path.join(tmpDir, ".gitignore"), "utf8");
    assert.equal(gi2.split(".guarana/memory/").length - 1, 1);
  });

  it("appends entry to existing .gitignore", () => {
    fs.rmSync(vaultDir, { recursive: true, force: true });
    fs.writeFileSync(path.join(tmpDir, ".gitignore"), "node_modules\n");
    initVault(tmpDir);
    const gi = fs.readFileSync(path.join(tmpDir, ".gitignore"), "utf8");
    assert.ok(gi.includes("node_modules"));
    assert.ok(gi.includes(".guarana/memory/"));
  });

  it("loadConfig deep-merges file over defaults", () => {
    fs.writeFileSync(paths(vaultDir).config, JSON.stringify({ compactionThreshold: 5, capture: {} }));
    const cfg = loadConfig(vaultDir);
    assert.equal(cfg.compactionThreshold, 5);
    assert.equal(cfg.embeddingProvider, null);
    assert.equal(cfg.capture.enabled, true);
  });

  it("writeJsonl is atomic (no stray temp files; content replaced cleanly)", () => {
    const p = paths(vaultDir).nodes;
    writeJsonl(p, [{ id: "a", ts: 1 }]);
    assert.equal(readJsonl(p).length, 1);
    // Overwrite via the read-modify-write path many times; must never tear.
    for (let i = 0; i < 20; i++) {
      const current = readJsonl(p).map((r) => ({ ...r, bump: i }));
      writeJsonl(p, current);
    }
    assert.ok(readJsonl(p).every((r) => r.bump === 19));
    const leftovers = fs.readdirSync(path.dirname(p)).filter((f) => f.includes(".tmp"));
    assert.deepEqual(leftovers, []);
  });
});

describe("graph CRUD", () => {
  it("round-trip: create → read → update status → reload → identical", () => {
    const node = createNode(vaultDir, {
      type: "decision",
      status: "draft",
      intent: "use JSONL",
      tags: ["storage"],
      summary: "decided JSONL",
    });
    assert.match(node.id, /^mem-\d+-[0-9a-f]+$/);
    assert.deepEqual(getNode(vaultDir, node.id), node);
    const updated = updateNode(vaultDir, node.id, { status: "confirmed" });
    assert.equal(updated.status, "confirmed");
    // reload from disk
    const reloaded = readJsonl(paths(vaultDir).nodes).find((n) => n.id === node.id);
    assert.deepEqual(reloaded, updated);
    assert.deepEqual(getNode(vaultDir, node.id), updated);
  });

  it("edge CRUD round-trip", () => {
    const a = createNode(vaultDir, { type: "bug", status: "confirmed", ts: 1 });
    const b = createNode(vaultDir, { type: "solution", status: "confirmed", ts: 2 });
    const e = createEdge(vaultDir, { from: b.id, to: a.id, rel: "caused-by" });
    assert.deepEqual(listEdges(vaultDir), [e]);
    assert.deepEqual(readJsonl(paths(vaultDir).edges), [e]);
  });

  it("rejects malformed nodes", () => {
    const base = { id: "mem-1-x", type: "atom", status: "draft", ts: 1 };
    for (const bad of [
      { ...base, id: undefined },
      { ...base, type: undefined },
      { ...base, ts: undefined },
      { ...base, status: undefined },
      { ...base, type: "nope" },
      { ...base, status: "nope" },
      { ...base, tags: "not-array" },
    ]) {
      assert.throws(() => addNode(vaultDir, bad), MemoryValidationError);
    }
  });

  it("rejects edges referencing unknown node ids", () => {
    const a = createNode(vaultDir, { type: "atom", status: "draft", ts: 1 });
    assert.throws(
      () => addEdge(vaultDir, { from: a.id, to: "mem-ghost", rel: "depends-on", ts: 2 }),
      MemoryValidationError
    );
    assert.throws(
      () => addEdge(vaultDir, { from: a.id, to: a.id, rel: "bogus", ts: 2 }),
      MemoryValidationError
    );
  });
});

describe("search", () => {
  beforeEach(() => {
    const hash = projectHashFor(tmpDir);
    createNode(vaultDir, {
      type: "decision",
      status: "confirmed",
      ts: 100,
      intent: "chose JSONL storage for memory graph",
      summary: "append-friendly persistence",
      tags: ["storage"],
      projectHash: hash,
      author: "agent",
    });
    createNode(vaultDir, {
      type: "bug",
      status: "confirmed",
      ts: 200,
      intent: "race condition in telemetry writer",
      tags: ["telemetry"],
      projectHash: "other",
    });
    createNode(vaultDir, {
      type: "atom",
      status: "draft",
      ts: 300,
      intent: "JSONL draft atom must never surface",
      tags: ["storage"],
      projectHash: hash,
    });
  });

  it("returns only confirmed nodes; drafts never appear", async () => {
    const res = await searchVault(vaultDir, { query: "JSONL" });
    assert.ok(res.length >= 1);
    assert.ok(res.every((n) => n.status === "confirmed"));
    const all = await searchVault(vaultDir, {});
    assert.ok(all.every((n) => n.status === "confirmed"));
    assert.equal(all.length, 2);
  });

  it("TF-IDF ranking orders results by relevance", async () => {
    const res = await searchVault(vaultDir, { query: "JSONL storage persistence" });
    assert.equal(res[0].type, "decision");
    assert.ok(res[0].score > 0);
    if (res.length > 1) assert.ok(res[0].score >= res[1].score);
  });

  it("structural filters: type, project, date range, author", async () => {
    const hash = projectHashFor(tmpDir);
    assert.equal((await searchVault(vaultDir, { type: "bug" })).length, 1);
    assert.equal((await searchVault(vaultDir, { project: hash })).length, 1);
    assert.equal((await searchVault(vaultDir, { author: "agent" })).length, 1);
    assert.equal((await searchVault(vaultDir, { since: 150 })).length, 1);
    assert.equal((await searchVault(vaultDir, { until: 150 })).length, 1);
    assert.equal((await searchVault(vaultDir, { since: 50, until: 250 })).length, 2);
    assert.equal(
      (await searchVault(vaultDir, { type: "bug", project: hash })).length,
      0
    );
  });

  it("falls back to TF-IDF when embedding provider errors", async () => {
    fs.writeFileSync(
      paths(vaultDir).config,
      JSON.stringify({ embeddingProvider: "./does-not-exist.mjs" })
    );
    const res = await searchVault(vaultDir, { query: "JSONL" });
    assert.ok(res.length >= 1);
    assert.ok(res.every((n) => n.status === "confirmed"));
  });

  it("never imports an unallowlisted embedding provider" + " — only allowlisted ids resolve", async () => {
    // Set embeddingProvider to a module that, if imported, would drop a marker
    // file. The allowlist must prevent the import, so the marker never appears.
    const boom = path.join(tmpDir, "boom.mjs");
    fs.writeFileSync(boom, `import fs from "node:fs";\nfs.writeFileSync("${path.join(tmpDir, "IMPORTED")}","x");\nexport const embed = async () => [];\n`);
    fs.writeFileSync(paths(vaultDir).config, JSON.stringify({ embeddingProvider: boom }));
    await searchVault(vaultDir, { query: "JSONL" });
    assert.ok(!fs.existsSync(path.join(tmpDir, "IMPORTED")), "provider module was imported — security bypass");
  });

  it("tokenizes accented content so folded and accented queries both match", async () => {
    const hash = projectHashFor(tmpDir);
    createNode(vaultDir, {
      type: "decision",
      status: "confirmed",
      ts: 1,
      intent: "escolhemos usar resolução e armazenamento próprio",
      summary: "decisão sobre resolução",
      tags: ["pt"],
      projectHash: hash,
    });
    const byFold = await searchVault(vaultDir, { query: "resolucao" });
    assert.ok(byFold.length >= 1);
    assert.equal(byFold[0].intent.includes("resolução"), true, "folded query should hit accented node");
    const byAccent = await searchVault(vaultDir, { query: "resolucão armazenamento" });
    assert.ok(byAccent.length >= 1);
  });
});

describe("security", () => {
  it("detects sensitive shapes", () => {
    assert.ok(isSensitive("key: sk-abcdefghijklmnopqrstuvwxyz"));
    assert.ok(isSensitive("aws AKIAIOSFODNN7EXAMPLE here"));
    assert.ok(isSensitive("ghp_abcdefghijklmnopqrstuvwxyz0123456789"));
    assert.ok(isSensitive("-----BEGIN RSA PRIVATE KEY-----\nabc"));
    assert.ok(isSensitive("Authorization: Bearer abcdef1234567890"));
    assert.ok(isSensitive("DB_HOST=x\nDB_PASS=y")); // .env block
    assert.ok(!isSensitive("just a normal decision note"));
    assert.ok(!isSensitive("ONE_LINE=value"));
    assert.ok(!isSensitive("please ask-questions and check the desk-top")); // benign lookalikes
    assert.ok(!isSensitive("risk-assessment is normal prose"));
  });

  it("flags and redacts short sk- API keys (8+ char suffix)", () => {
    const key = "sk-abc123def456";
    assert.ok(isSensitive(`used key ${key}`));
    assert.ok(!sanitize(`used key ${key}`).includes(key));
  });

  it("captureAtom never persists sk-abc123def456 verbatim", () => {
    const r = captureAtom(vaultDir, { intent: "called api", output: "key was sk-abc123def456" });
    const onDisk = fs.readFileSync(paths(vaultDir).nodes, "utf8");
    assert.ok(!onDisk.includes("sk-abc123def456"));
    if (r.captured) assert.ok(onDisk.includes("[REDACTED]"));
  });

  it("flags and redacts short ghp_ tokens (8+ char suffix)", () => {
    const tok = "ghp_16charstringxx";
    assert.ok(isSensitive(`used token ${tok}`));
    assert.ok(!sanitize(`used token ${tok}`).includes(tok));
  });

  it("captureAtom never persists ghp_16charstringxx verbatim", () => {
    const r = captureAtom(vaultDir, { intent: "called api", output: "token was ghp_16charstringxx" });
    const onDisk = fs.readFileSync(paths(vaultDir).nodes, "utf8");
    assert.ok(!onDisk.includes("ghp_16charstringxx"));
    if (r.captured) assert.ok(onDisk.includes("[REDACTED]"));
  });

  it("sanitize redacts secrets", () => {
    assert.equal(sanitize("api_key=supersecretvalue123"), "api_key=[REDACTED]");
    assert.ok(sanitize("token: abcdef123456").includes("[REDACTED]"));
    assert.ok(!sanitize("sk-abcdefghijklmnopqrstuvwxyz").includes("sk-abc"));
    assert.ok(
      sanitize("-----BEGIN PRIVATE KEY-----\nx\n-----END PRIVATE KEY-----").includes("[REDACTED]")
    );
  });

  it("captureAtom rejects sensitive content entirely — nothing persisted", () => {
    const r = captureAtom(vaultDir, { intent: "read .env", output: "DB_HOST=x\nDB_PASS=y" });
    assert.equal(r.captured, false);
    assert.equal(r.reason, "sensitive-content");
    assert.equal(listNodes(vaultDir).length, 0);
  });

  it("captureAtom sanitizes redactable content and persists draft atom", () => {
    const secret = "supersecretvalue123";
    const r = captureAtom(vaultDir, {
      intent: "called api",
      input: `api_key=${secret}`,
      output: "ok",
      decision: "retry later",
    });
    assert.equal(r.captured, true);
    assert.equal(r.node.status, "draft");
    assert.equal(r.node.type, "atom");
    assert.equal(r.node.projectHash, projectHashFor(tmpDir));
    assert.ok(r.node.input.includes("[REDACTED]"));
    const onDisk = fs.readFileSync(paths(vaultDir).nodes, "utf8");
    assert.ok(!onDisk.includes(secret));
  });

  it("export after memory_save_decision never contains raw secrets", async () => {
    const secret = "supersecretvalue123";
    const { memorySaveDecision } = await import("./tools.js");
    await memorySaveDecision(vaultDir, {
      intent: "called api",
      decision: `the returned key was api_key=${secret}, rotated next day`,
      rejectedAlternatives: [],
      tags: ["sec"],
      author: "agent",
    });
    const outFile = path.join(tmpDir, "sec-export.json");
    exportVault(vaultDir, outFile);
    const text = fs.readFileSync(outFile, "utf8");
    assert.ok(!text.includes(secret));
  });
});

describe("export/import", () => {
  it("export → single JSON file; import into fresh vault → identical set", () => {
    const a = createNode(vaultDir, { type: "decision", status: "confirmed", ts: 1, intent: "x" });
    const b = createNode(vaultDir, { type: "bug", status: "draft", ts: 2, intent: "y" });
    createEdge(vaultDir, { from: b.id, to: a.id, rel: "depends-on", ts: 3 });
    const outFile = path.join(tmpDir, "export.json");
    exportVault(vaultDir, outFile);
    const parsed = JSON.parse(fs.readFileSync(outFile, "utf8"));
    assert.equal(parsed.version, 1);
    assert.ok(parsed.exportedAt);
    assert.equal(parsed.nodes.length, 2);
    assert.equal(parsed.edges.length, 1);

    const tmp2 = fs.mkdtempSync(path.join(os.tmpdir(), "guarana-memory-imp-"));
    try {
      const fresh = initVault(tmp2);
      importVault(fresh, outFile);
      const byId = (arr) => [...arr].sort((x, y) => (x.id || x.from).localeCompare(y.id || y.from));
      assert.deepEqual(byId(listNodes(fresh)), byId(listNodes(vaultDir)));
      assert.deepEqual(byId(listEdges(fresh)), byId(listEdges(vaultDir)));
    } finally {
      fs.rmSync(tmp2, { recursive: true, force: true });
    }
  });
});
