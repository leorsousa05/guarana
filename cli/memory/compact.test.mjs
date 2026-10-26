import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { initVault, paths, writeJsonl } from "./vault.js";
import { addEdge, listNodes } from "./graph.js";
import { compactVault } from "./compact.js";

let tmpDir;
let vaultDir;

const seed = (rows) => writeJsonl(paths(vaultDir).nodes, rows);

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "guarana-compact-"));
  vaultDir = initVault(tmpDir);
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("compaction", () => {
  it("preserves legacy atoms and all legacy supernodes byte-for-byte", () => {
    seed([
      { id: "atom-confirmed", type: "atom", status: "confirmed", ts: 1, intent: "legacy", summary: "keep" },
      { id: "atom-draft", type: "atom", status: "draft", ts: 2, intent: "pending", summary: "keep" },
      { id: "metadata-supernode", type: "supernode", status: "confirmed", ts: 3, summary: "supernode summarizing 1 atom node(s) ts range: 1..1" },
      { id: "useful-supernode", type: "supernode", status: "confirmed", ts: 4, summary: "Keep this legacy summary." },
    ]);
    addEdge(vaultDir, { from: "atom-confirmed", to: "metadata-supernode", rel: "summarizes", ts: 5 });
    addEdge(vaultDir, { from: "atom-draft", to: "useful-supernode", rel: "relates-to", ts: 6 });
    const beforeNodes = fs.readFileSync(paths(vaultDir).nodes);
    const beforeEdges = fs.readFileSync(paths(vaultDir).edges);

    const result = compactVault(vaultDir, { threshold: 0 });

    assert.deepEqual(result, { compacted: 0, remaining: 2, removedSupernodes: 0 });
    assert.deepEqual(fs.readFileSync(paths(vaultDir).nodes), beforeNodes);
    assert.deepEqual(fs.readFileSync(paths(vaultDir).edges), beforeEdges);
    assert.equal(listNodes(vaultDir).filter((node) => node.type === "supernode").length, 2);
  });

  it("is a no-op when there are no legacy atoms", () => {
    seed([{ id: "decision", type: "decision", status: "confirmed", ts: 1, summary: "Keep" }]);
    const beforeNodes = fs.readFileSync(paths(vaultDir).nodes);
    const beforeEdges = fs.readFileSync(paths(vaultDir).edges);

    assert.deepEqual(compactVault(vaultDir), { compacted: 0, remaining: 0, removedSupernodes: 0 });
    assert.deepEqual(fs.readFileSync(paths(vaultDir).nodes), beforeNodes);
    assert.deepEqual(fs.readFileSync(paths(vaultDir).edges), beforeEdges);
  });
});
