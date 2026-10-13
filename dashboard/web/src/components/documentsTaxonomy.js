const fallbackTitle = (rel) => rel.split('/').pop().replace(/\.md$/i, '');

const adrNum = (rel) => {
  const match = String(rel).match(/ADR-(\d+)/i);
  return match ? parseInt(match[1], 10) : Infinity;
};

const folderLabel = (folder) => folder
  .replace(/[-_]+/g, ' ')
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

const datedFilename = (rel) => {
  const filename = rel.split('/').pop();
  const match = filename.match(/^(\d{4})-(\d{2})-(\d{2})(?=-|\.md$)/i);
  if (!match) return null;
  const [, year, month, day] = match;
  const monthNumber = Number(month);
  const dayNumber = Number(day);
  if (monthNumber < 1 || monthNumber > 12 || dayNumber < 1 || dayNumber > 31) return null;
  return { month: `${year}-${month}`, date: `${year}-${month}-${day}` };
};

const monthLabel = (month) => {
  const [year, monthNumber] = month.split('-').map(Number);
  return `${new Intl.DateTimeFormat('en', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(year, monthNumber - 1, 1)))} ${year}`;
};

const createGroup = (key, label, items = [], children = []) => ({ key, label, items, children });

const countDocuments = (groups) => groups.reduce((count, group) => (
  count + group.items.length + countDocuments(group.children)
), 0);

const countGroup = (group) => {
  const children = group.children.map(countGroup);
  return { ...group, children, count: group.items.length + countDocuments(children) };
};

const addToFolderTree = (root, segments, path) => {
  let current = root;
  for (const segment of segments) {
    let child = current.children.find((group) => group.key === `${current.key}/${segment}`);
    if (!child) {
      child = createGroup(`${current.key}/${segment}`, folderLabel(segment));
      current.children.push(child);
    }
    current = child;
  }
  current.items.push(path);
};

export function buildGroups(tree) {
  const candidates = [...new Set((tree || []).filter((path) => (
    typeof path === 'string' && /\.md$/i.test(path) && !/^state\//.test(path)
  )))];
  const hasArchivedArtifacts = candidates.some((path) => (
    /^archive\//i.test(path) && path.toLowerCase() !== 'archive/readme.md'
  ));
  const list = candidates.filter((path) => (
    hasArchivedArtifacts || path.toLowerCase() !== 'archive/readme.md'
  ));
  const groups = [];

  const decisionPaths = list.filter((path) => /^decisions\//.test(path));
  decisionPaths.sort((a, b) => {
    const aNumber = adrNum(a);
    const bNumber = adrNum(b);
    if (Number.isFinite(aNumber) !== Number.isFinite(bNumber)) return Number.isFinite(aNumber) ? -1 : 1;
    if (Number.isFinite(aNumber) && aNumber !== bNumber) return bNumber - aNumber;
    return a.localeCompare(b);
  });
  if (decisionPaths.length) groups.push(createGroup('decisions', 'Decisions', decisionPaths));

  const changePaths = list.filter((path) => /^changes\//.test(path));
  const changesByMonth = new Map();
  const otherChanges = [];
  for (const path of changePaths) {
    const dated = datedFilename(path);
    if (!dated) {
      otherChanges.push(path);
      continue;
    }
    const items = changesByMonth.get(dated.month) || [];
    items.push({ path, date: dated.date });
    changesByMonth.set(dated.month, items);
  }
  const changeGroups = [...changesByMonth.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([month, items]) => createGroup(
      `changes:${month}`,
      monthLabel(month),
      items.sort((a, b) => b.date.localeCompare(a.date) || b.path.localeCompare(a.path)).map(({ path }) => path),
    ));
  if (otherChanges.length) changeGroups.push(createGroup('changes:general', 'General', otherChanges.sort()));
  if (changeGroups.length) groups.push(createGroup('changes', 'Changes', [], changeGroups));

  const featurePaths = list.filter((path) => /^features\//.test(path));
  if (featurePaths.length) {
    const features = createGroup('features', 'Features');
    for (const path of featurePaths) {
      const folders = path.slice('features/'.length).split('/').slice(0, -1);
      addToFolderTree(features, folders.length ? folders : ['General / Overview'], path);
    }
    const sortTree = (node) => {
      node.items.sort();
      node.children.sort((a, b) => a.label.localeCompare(b.label));
      node.children.forEach(sortTree);
    };
    sortTree(features);
    groups.push(features);
  }

  const archivePaths = list.filter((path) => /^archive\//i.test(path));
  if (hasArchivedArtifacts) {
    groups.push(createGroup('archive', 'Archive', archivePaths.sort()));
  }

  const foundations = list.filter((path) => /^[^/]+\.md$/i.test(path)).sort();
  if (foundations.length) groups.push(createGroup('foundations', 'Foundations', foundations));

  const claimed = new Set(groups.flatMap((group) => flattenGroups([group])));
  const otherPaths = list.filter((path) => !claimed.has(path));
  if (otherPaths.length) {
    const other = createGroup('other', 'Other');
    for (const path of otherPaths) {
      addToFolderTree(other, path.split('/').slice(0, -1), path);
    }
    const sortTree = (node) => {
      node.items.sort();
      node.children.sort((a, b) => a.label.localeCompare(b.label));
      node.children.forEach(sortTree);
    };
    sortTree(other);
    groups.push(other);
  }

  return groups.map(countGroup);
}

function flattenGroups(groups) {
  return groups.flatMap((group) => [
    ...group.items,
    ...flattenGroups(group.children || []),
  ]);
}

export function filterDocumentGroups(groups, titles, query) {
  const needle = String(query || '').trim().toLocaleLowerCase();
  if (!needle) return groups;
  const filter = (group) => {
    const items = group.items.filter((path) => (
      `${titles[path] || fallbackTitle(path)} ${path}`.toLocaleLowerCase().includes(needle)
    ));
    const children = group.children.map(filter).filter((child) => child.count > 0);
    return { ...group, items, children, count: items.length + countDocuments(children) };
  };
  return groups.map(filter).filter((group) => group.count > 0);
}
