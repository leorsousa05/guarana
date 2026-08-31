import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { initVault, loadConfig, paths, writeJsonl } from "./vault.js";
import { addNode, listNodes, listEdges, createEdge, addEdge } from "./graph.js";
import { compactVault } from "./compact.js";

let tmpDir;
let vaultDir;

const seed = (rows) => {
  writeJsonl(paths(vaultDir).nodes, rows);
};

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "guarana-compact-"));
  vaultDir = initVault(tmpDir);
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const atom = (i, extra = {}) => ({
  id: `atom-${i}`,
  type: "atom",
  status: "draft",
  ts: i,
  tags: [],
  ...extra,
});

describe("compaction", () => {
  it("compacts oldest atoms down to threshold, preserving decision text verbatim (criterion 14)", () => {
    const rows = [
      atom(1, { decision: "first decision here" }),
      atom(2, { decision: "second decision here" }),
      atom(3),
      atom(4),
      atom(5, { decision: "third decision here" }),
    ];
    seed(rows);
    const r = compactVault(vaultDir, { threshold: 2 });
    assert.equal(r.compacted, 3);
    assert.ok(r.supernodeId);
    assert.equal(r.remaining, 2);
    const nodes = listNodes(vaultDir);
    assert.equal(nodes.length, 3); // 2 atoms + 1 supernode
    const sup = nodes.find((n) => n.id === r.supernodeId);
    assert.equal(sup.type, "supernode");
    assert.equal(sup.status, "confirmed");
    assert.ok(sup.summary.includes("supernode summarizing 3 atom node(s)"));
    assert.ok(sup.summary.includes("first decision here"));
    assert.ok(sup.summary.includes("second decision here"));
    // remaining atoms are the newest two
    const remaining = nodes.filter((n) => n.type === "atom");
    assert.deepEqual(remaining.map((n) => n.id).sort(), ["atom-4", "atom-5"]);
    // newest surviving atom keeps its own decision text
    assert.equal(remaining.find((n) => n.id === "atom-5").decision, "third decision here");
  });

  it("is idempotent: second run with no new nodes is a no-op (criterion 15)", () => {
    seed([atom(1), atom(2), atom(3), atom(4), atom(5)]);
    const first = compactVault(vaultDir, { threshold: 2 });
    assert.equal(first.compacted, 3);
    const second = compactVault(vaultDir, { threshold: 2 });
    assert.equal(second.compacted, 0);
    assert.equal(second.remaining, 2);
    assert.equal(second.supernodeId, undefined);
    const before = JSON.stringify(listNodes(vaultDir));
    const again = compactVault(vaultDir, { threshold: 2 });
    assert.equal(again.compacted, 0);
    assert.equal(JSON.stringify(listNodes(vaultDir)), before);
  });

  it("is a no-op when at or below threshold", () => {
    seed([atom(1), atom(2)]);
    const r = compactVault(vaultDir, { threshold: 2 });
    assert.equal(r.compacted, 0);
    assert.equal(r.remaining, 2);
    assert.equal(listNodes(vaultDir).length, 2);
  });

  it("is a no-op when only decisions/bugs/supernodes present regardless of threshold", () => {
    seed([
      { id: "d1", type: "decision", status: "confirmed", ts: 1, tags: [] },
      { id: "b1", type: "bug", status: "confirmed", ts: 2, tags: [] },
      { id: "s1", type: "supernode", status: "confirmed", ts: 3, tags: [], collapsedIds: [] },
    ]);
    const r = compactVault(vaultDir, { threshold: 0 });
    assert.equal(r.compacted, 0);
    assert.equal(r.remaining, 0);
    assert.equal(listNodes(vaultDir).length, 3);
  });

  it("empty vault compacts to no-op", () => {
    const r = compactVault(vaultDir, { threshold: 1 });
    assert.equal(r.compacted, 0);
    assert.equal(r.remaining, 0);
    assert.equal(listNodes(vaultDir).length, 0);
  });

  it("records collapsedIds provenance on the supernode", () => {
    seed([atom(1), atom(2), atom(3), atom(4)]);
    const r = compactVault(vaultDir, { threshold: 1 });
    const sup = listNodes(vaultDir).find((n) => n.id === r.supernodeId);
    assert.deepEqual(sup.collapsedIds, ["atom-1", "atom-2", "atom-3"]);
  });

  it("removes collapsed atoms and drops edges touching them (no dangling refs)", () => {
    seed([atom(1), atom(2), atom(3), atom(4)]);
    addEdge(vaultDir, { from: "atom-1", to: "atom-4", rel: "depends-on", ts: 1 });
    addEdge(vaultDir, { from: "atom-2", to: "atom-3", rel: "caused-by", ts: 2 });
    const r = compactVault(vaultDir, { threshold: 2 }); // collapses atom-1, atom-2
    const edges = listEdges(vaultDir);
    // edges touching collapsed atoms (atom-1, atom-2) are dropped
    assert.ok(!edges.some((e) => e.from === "atom-1" || e.to === "atom-1"));
    assert.ok(!edges.some((e) => e.from === "atom-2" || e.to === "atom-2"));
    // no dangling refs: all edges reference surviving nodes
    const ids = new Set(listNodes(vaultDir).map((n) => n.id));
    for (const e of edges) {
      assert.ok(ids.has(e.from), `dangling from ${e.from}`);
      assert.ok(ids.has(e.to), `dangling to ${e.to}`);
    }
    assert.equal(edges.length, 0); // both edges referenced collapsed atoms
    assert.ok(r.compacted === 2);
  });

  it("defaults threshold from config.json when not passed", () => {
    fs.writeFileSync(paths(vaultDir).config, JSON.stringify({ compactionThreshold: 1 }));
    seed([atom(1), atom(2), atom(3)]);
    const r = compactVault(vaultDir);
    assert.equal(r.compacted, 2);
    assert.equal(r.remaining, 1);
  });
});