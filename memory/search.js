// guarana memory — hybrid search: structural filters, then TF-IDF cosine ranking
// (pluggable embedding provider seam, ADR-009). Only confirmed nodes returned. Zero deps.
import { listNodes } from "./graph.js";
import { loadConfig } from "./vault.js";

const tokenize = (text) =>
  String(text)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1);

const nodeText = (n) =>
  [n.intent, n.summary, (n.tags || []).join(" ")].filter(Boolean).join(" ");

function cosine(a, b) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const k of Object.keys(a)) {
    na += a[k] * a[k];
    if (b[k]) dot += a[k] * b[k];
  }
  for (const k of Object.keys(b)) nb += b[k] * b[k];
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

function tfidfRank(query, docs) {
  const corpus = docs.map((d) => tokenize(d.text));
  const df = {};
  for (const toks of corpus) for (const t of new Set(toks)) df[t] = (df[t] || 0) + 1;
  const N = corpus.length;
  const idf = (t) => Math.log(1 + N / (1 + (df[t] || 0)));
  const vec = (toks) => {
    const tf = {};
    for (const t of toks) tf[t] = (tf[t] || 0) + 1;
    const v = {};
    for (const [t, c] of Object.entries(tf)) v[t] = (c / toks.length) * idf(t);
    return v;
  };
  const qv = vec(tokenize(query));
  return docs.map((d, i) => ({ node: d.node, score: cosine(qv, vec(corpus[i])) }));
}

async function providerRank(providerName, query, docs) {
  const mod = await import(providerName);
  const embed = mod.embed || (mod.default && mod.default.embed);
  if (typeof embed !== "function") throw new Error("provider has no embed()");
  const qv = await embed(query);
  const out = [];
  for (const d of docs) {
    const dv = await embed(d.text);
    let dot = 0;
    let nq = 0;
    let nd = 0;
    for (let i = 0; i < qv.length; i++) {
      dot += qv[i] * (dv[i] || 0);
      nq += qv[i] * qv[i];
      nd += (dv[i] || 0) * (dv[i] || 0);
    }
    out.push({ node: d.node, score: nq && nd ? dot / (Math.sqrt(nq) * Math.sqrt(nd)) : 0 });
  }
  return out;
}

export async function searchVault(vaultDir, opts = {}) {
  const { query, type, project, since, until, author, limit = 20 } = opts;
  let nodes = listNodes(vaultDir).filter((n) => n.status === "confirmed");
  if (type) nodes = nodes.filter((n) => n.type === type);
  if (project) nodes = nodes.filter((n) => n.projectHash === project);
  if (author) nodes = nodes.filter((n) => n.author === author);
  if (since != null) nodes = nodes.filter((n) => n.ts >= since);
  if (until != null) nodes = nodes.filter((n) => n.ts <= until);

  const docs = nodes.map((node) => ({ node, text: nodeText(node) }));
  let ranked;
  if (query && docs.length) {
    const provider = loadConfig(vaultDir).embeddingProvider;
    if (provider) {
      try {
        ranked = await providerRank(provider, query, docs);
      } catch {
        ranked = tfidfRank(query, docs); // fall back on any provider error
      }
    } else {
      ranked = tfidfRank(query, docs);
    }
    ranked = ranked.filter((r) => r.score > 0);
    ranked.sort((a, b) => b.score - a.score);
  } else {
    ranked = docs
      .map((d) => ({ node: d.node, score: 0 }))
      .sort((a, b) => b.node.ts - a.node.ts);
  }
  return ranked.slice(0, limit).map((r) => ({ ...r.node, score: r.score }));
}
