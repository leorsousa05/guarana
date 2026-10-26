// Legacy atoms and supernodes remain readable, but strict project memory no
// longer compacts, deletes, or cleans them. Keep this command as a safe no-op.
import { listNodes } from "./graph.js";

// Returns the historical result shape without writing to nodes or edges.
export function compactVault(vaultDir) {
  const nodes = listNodes(vaultDir);
  return {
    compacted: 0,
    remaining: nodes.filter((node) => node.type === "atom").length,
    removedSupernodes: 0,
  };
}
