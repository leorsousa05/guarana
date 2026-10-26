import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import {
  initVault,
  initUserVault,
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
  removeEdge,
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

  it("initializes an isolated user vault without touching a project gitignore", () => {
    const home = path.join(tmpDir, "fake-home");
    const userVault = initUserVault(home);
    assert.equal(userVault, path.join(home, ".config", "guarana", "memory"));
    assert.ok(fs.existsSync(paths(userVault).nodes));
    assert.ok(fs.existsSync(paths(userVault).config));
    assert.equal(fs.existsSync(path.join(home, ".gitignore")), false);
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

  it("removes only the exact selected edge", () => {
    const a = createNode(vaultDir, { type: "bug", status: "confirmed", ts: 1 });
    const b = createNode(vaultDir, { type: "solution", status: "confirmed", ts: 2 });
    const selected = createEdge(vaultDir, { from: a.id, to: b.id, rel: "fixes", ts: 3 });
    const retained = createEdge(vaultDir, { from: a.id, to: b.id, rel: "relates-to", ts: 4 });

    assert.deepEqual(removeEdge(vaultDir, selected), selected);
    assert.deepEqual(listEdges(vaultDir), [retained]);
    assert.equal(removeEdge(vaultDir, selected), null);
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
      { ...base, priority: "essential" },
      { ...base, type: "preference", scope: "project", priority: "normal" },
      { ...base, type: "preference", scope: "global", priority: "urgent" },
    ]) {
      assert.throws(() => addNode(vaultDir, bad), MemoryValidationError);
    }
    assert.equal(createNode(vaultDir, {
      type: "preference", status: "confirmed", scope: "global", priority: "essential", ts: 2,
    }).priority, "essential");
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
  it("saves typed bugs and solutions with explicit links returned in task context", async () => {
    const { memorySaveNode, memoryGetContextForTask } = await import("./tools.js");
    const bug = await memorySaveNode(vaultDir, {
      type: "bug",
      intent: "retries disappear after timeout",
      summary: "The retry scheduler drops jobs after a worker timeout.",
      tags: ["scheduler"],
    });
    const solution = await memorySaveNode(vaultDir, {
      type: "solution",
      intent: "preserve timed-out retry jobs",
      summary: "Requeue the job when a worker times out.",
      relatedTo: [{ id: bug.id, rel: "fixes" }],
    });
    assert.equal(bug.type, "bug");
    assert.equal(solution.type, "solution");
    assert.deepEqual(solution.edges.map((e) => [e.from, e.to, e.rel]), [
      [solution.id, bug.id, "fixes"],
    ]);

    const context = await memoryGetContextForTask(vaultDir, { task: "retry job worker timeout" });
    assert.ok(context.bugs.some((n) => n.id === bug.id));
    assert.ok(context.solutions.some((n) => n.id === solution.id));
  });

  it("saves a standing preference globally and retrieves it independent of task wording", async () => {
    const { memorySaveNode, memoryGetGlobalPreferences } = await import("./tools.js");
    const globalVault = initUserVault(path.join(tmpDir, "user-home"));
    const preference = await memorySaveNode(globalVault, {
      type: "preference",
      scope: "global",
      intent: "response language",
      summary: "Always answer me in Portuguese.",
      tags: ["style"],
    });
    assert.equal(preference.scope, "global");
    assert.equal(preference.projectHash, null);
    const result = await memoryGetGlobalPreferences(globalVault, { limit: 3 });
    assert.equal(result.count, 1);
    assert.equal(result.preferences[0].id, preference.id);
    assert.equal(result.preferences[0].summary, "Always answer me in Portuguese.");
    const replacement = await memorySaveNode(globalVault, {
      type: "preference",
      scope: "global",
      intent: "response language",
      summary: "Use concise Portuguese answers.",
      relatedTo: [{ id: preference.id, rel: "supersedes" }],
    });
    const current = await memoryGetGlobalPreferences(globalVault, { limit: 3 });
    assert.equal(current.count, 1);
    assert.equal(current.preferences[0].id, replacement.id);
    assert.equal(current.preferences[0].priority, "normal");
  });

  it("prioritizes the three newest essential global preferences and treats legacy priority as normal", async () => {
    const { memoryGetGlobalPreferences } = await import("./tools.js");
    const globalVault = initUserVault(path.join(tmpDir, "priority-home"));
    const add = (id, ts, priority) => createNode(globalVault, {
      id, type: "preference", status: "confirmed", scope: "global", ts,
      ...(priority ? { priority } : {}), intent: id, summary: `Preference ${id}`,
    });
    add("normal-newest", 100);
    add("essential-old", 10, "essential");
    add("essential-middle", 30, "essential");
    add("essential-newer", 40, "essential");
    add("essential-newest", 50, "essential");
    const capped = await memoryGetGlobalPreferences(globalVault, { limit: 20 });
    assert.deepEqual(capped.preferences.map(({ id, priority }) => [id, priority]), [
      ["essential-newest", "essential"],
      ["essential-newer", "essential"],
      ["essential-middle", "essential"],
    ]);
    assert.equal(capped.count, 3);

    const legacyOnly = initUserVault(path.join(tmpDir, "legacy-priority-home"));
    const legacy = createNode(legacyOnly, {
      type: "preference", status: "confirmed", scope: "global", ts: 1,
      intent: "legacy", summary: "No migration needed",
    });
    const legacyResult = await memoryGetGlobalPreferences(legacyOnly);
    assert.equal(legacyResult.preferences[0].id, legacy.id);
    assert.equal(legacyResult.preferences[0].priority, "normal");
    assert.equal(getNode(legacyOnly, legacy.id).priority, undefined);
  });

  it("selects every eligible active global preference while preserving one-hop historical and eligibility boundaries", async () => {
    const { memoryGetGlobalPreferences } = await import("./tools.js");
    const globalVault = initUserVault(path.join(tmpDir, "complete-preferences-home"));
    const active = Array.from({ length: 12 }, (_, index) => createNode(globalVault, {
      id: `complete-pref-${String(index + 1).padStart(2, "0")}`,
      type: "preference", status: "confirmed", scope: "global", ts: 200 - index,
      intent: `Synthetic active preference ${index + 1}`,
      summary: `Complete preference ${index + 1} — ${"Preserve all synthetic preference text. ".repeat(35)}`,
      ...(index === 0 ? { tags: ["ordinary-tag", "api_key=synthetic-fixture-secret-123"] } : {}),
    }));
    const old = createNode(globalVault, {
      id: "one-hop-old-pref", type: "preference", status: "confirmed", scope: "global", ts: 10,
      intent: "synthetic historical preference", summary: "One-hop historical preference.",
    });
    const secondHopOld = createNode(globalVault, {
      id: "second-hop-old-pref", type: "preference", status: "confirmed", scope: "global", ts: 9,
      intent: "synthetic second-hop historical preference", summary: "Must remain outside the one-hop context.",
    });
    const ineligible = [
      { id: "global-draft-preference", type: "preference", status: "draft", scope: "global", ts: 8, intent: "draft sentinel", summary: "Must not be selected." },
      { id: "global-decision-not-preference", type: "decision", status: "confirmed", scope: "global", ts: 7, intent: "wrong type sentinel", summary: "Must not be selected." },
      { id: "project-preference-in-global-vault", type: "preference", status: "confirmed", scope: "project", ts: 6, intent: "wrong scope sentinel", summary: "Must not be selected." },
    ];
    fs.appendFileSync(paths(globalVault).nodes, `${ineligible.map((node) => JSON.stringify(node)).join("\n")}\n`);
    createEdge(globalVault, { from: active[0].id, to: old.id, rel: "supersedes" });
    createEdge(globalVault, { from: old.id, to: secondHopOld.id, rel: "supersedes" });
    fs.appendFileSync(paths(globalVault).edges, `${ineligible.map((node) => JSON.stringify({
      from: active[0].id, to: node.id, rel: "relates-to", ts: 5,
    })).join("\n")}\n`);

    const files = [paths(globalVault).nodes, paths(globalVault).edges, paths(globalVault).config];
    const before = files.map((file) => fs.readFileSync(file));
    const selected = await memoryGetGlobalPreferences(globalVault, { complete: true });

    assert.deepEqual(selected.preferences.map(({ id }) => id), active.map(({ id }) => id));
    assert.equal(selected.preferences.length, 12, "complete selection exceeds the former direct-three and total-ten caps");
    assert.deepEqual(selected.relatedPreferences, []);
    assert.deepEqual(selected.relatedSuperseded.map(({ id }) => id), [old.id]);
    assert.equal(selected.preferences[0].summary, active[0].summary, "selection retains long preference text in full");
    assert.deepEqual(selected.preferences[0].tags, ["ordinary-tag"], "sensitive tag-shaped values are excluded");
    const selectedIds = [...selected.preferences, ...selected.relatedPreferences, ...selected.relatedSuperseded]
      .map(({ id }) => id);
    for (const node of [...ineligible, secondHopOld]) assert.ok(!selectedIds.includes(node.id));
    assert.ok([...selected.preferences, ...selected.relatedSuperseded]
      .every(({ scope, type }) => scope === "global" && type === "preference"));
    assert.deepEqual(files.map((file) => fs.readFileSync(file)), before, "selection reads leave synthetic fixture bytes unchanged");
  });

  it("rejects priority on non-global preferences and unsupported priority values", async () => {
    const { memorySaveNode } = await import("./tools.js");
    for (const options of [
      { type: "decision", scope: "global", priority: "essential" },
      { type: "preference", scope: "project", priority: "normal" },
      { type: "preference", scope: "global", priority: "urgent" },
    ]) {
      await assert.rejects(() => memorySaveNode(vaultDir, {
        ...options, intent: "priority validation", summary: "must not persist",
      }), /priority/);
    }
    assert.equal(listNodes(vaultDir).length, 0);
  });

  it("deletes only a confirmed exact-scope node and cleans incident edges", async () => {
    const { memoryDeleteNode } = await import("./tools.js");
    const target = createNode(vaultDir, {
      type: "decision", status: "confirmed", scope: "project", intent: "target text", summary: "target summary",
    });
    const other = createNode(vaultDir, {
      type: "bug", status: "confirmed", scope: "project", intent: "other", summary: "other",
    });
    createEdge(vaultDir, { from: target.id, to: other.id, rel: "fixes" });
    createEdge(vaultDir, { from: other.id, to: target.id, rel: "relates-to" });
    const retained = createEdge(vaultDir, { from: other.id, to: other.id, rel: "depends-on" });

    assert.deepEqual(await memoryDeleteNode(vaultDir, {
      id: target.id, scope: "project", confirm: true,
    }), { id: target.id, deleted: true });
    assert.equal(getNode(vaultDir, target.id), null);
    assert.deepEqual(listEdges(vaultDir), [retained]);
  });

  it("requires ID, matching scope, explicit confirmation, and confirmed status for deletion", async () => {
    const { memoryDeleteNode } = await import("./tools.js");
    const confirmed = createNode(vaultDir, {
      type: "decision", status: "confirmed", scope: "project", intent: "keep", summary: "keep",
    });
    const draft = createNode(vaultDir, {
      type: "atom", status: "draft", scope: "project", intent: "draft", summary: "draft",
    });
    await assert.rejects(() => memoryDeleteNode(vaultDir, { scope: "project", confirm: true }), /id is required/);
    await assert.rejects(() => memoryDeleteNode(vaultDir, { id: confirmed.id, confirm: true }), /scope is required/);
    await assert.rejects(() => memoryDeleteNode(vaultDir, { id: confirmed.id, scope: "global", confirm: true }), /scope does not match/);
    await assert.rejects(() => memoryDeleteNode(vaultDir, { id: confirmed.id, scope: "project" }), /confirmation is required/);
    await assert.rejects(() => memoryDeleteNode(vaultDir, { id: "mem-unknown", scope: "project", confirm: true }), /unknown node id/);
    await assert.rejects(() => memoryDeleteNode(vaultDir, { id: draft.id, scope: "project", confirm: true }), /not confirmed/);
    assert.ok(getNode(vaultDir, confirmed.id));
    assert.ok(getNode(vaultDir, draft.id));
  });

  it("uses lexical relevance gates for project seeds and expands one hop only from qualifying seeds", async () => {
    const { memoryGetContextForTask } = await import("./tools.js");
    const strong = createNode(vaultDir, {
      type: "decision", status: "confirmed", scope: "project",
      intent: "OAuth refresh token rotation", summary: "OAuth token refresh prevents expiry",
    });
    const incidental = createNode(vaultDir, {
      type: "decision", status: "confirmed", scope: "project",
      intent: "unrelated database migration deployment", summary: "The design note mentions token once",
    });
    const linked = createNode(vaultDir, {
      type: "bug", status: "confirmed", scope: "project",
      intent: "historic provider edge behavior", summary: "Retained through explicit relation",
    });
    const secondHop = createNode(vaultDir, {
      type: "solution", status: "confirmed", scope: "project",
      intent: "unrelated cache adjustment", summary: "Must not expand transitively",
    });
    const draft = createNode(vaultDir, {
      type: "bug", status: "draft", scope: "project",
      intent: "OAuth refresh token rotation", summary: "Draft is never retrieved",
    });
    createEdge(vaultDir, { from: strong.id, to: linked.id, rel: "relates-to" });
    createEdge(vaultDir, { from: linked.id, to: secondHop.id, rel: "fixes" });

    const context = await memoryGetContextForTask(vaultDir, { task: "OAuth refresh token rotation flow" });
    const selected = ["decisions", "bugs", "solutions", "refactors", "preferences", "superseded", "atoms"]
      .flatMap((group) => context[group]);
    assert.ok(selected.some((node) => node.id === strong.id), "clear multi-term match passes");
    assert.ok(selected.some((node) => node.id === linked.id), "one-hop neighbor of qualifying seed passes");
    assert.ok(!selected.some((node) => node.id === incidental.id), "single incidental overlap fails");
    assert.ok(!selected.some((node) => node.id === secondHop.id), "neighbor is not used as a second-hop seed");
    assert.ok(!selected.some((node) => node.id === draft.id), "drafts stay excluded");
  });

  it("rejects invalid memory links before persisting an orphan node", async () => {
    const { memorySaveNode } = await import("./tools.js");
    await assert.rejects(
      () => memorySaveNode(vaultDir, {
        type: "bug",
        intent: "test bug",
        summary: "test summary",
        relatedTo: [{ id: "missing", rel: "fixes" }],
      }),
      /existing confirmed node/
    );
    assert.equal(listNodes(vaultDir).length, 0);
  });

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
