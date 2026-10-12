'use strict';

const fs = require('fs');
const path = require('path');
const engineArtifacts = require('./engine-artifacts.js');
const agents = require('./agents.js');
const advisorProfiles = require('./advisor-profiles.js');
const { openCodeRootTarget, installManifestTarget, legacyAdvisorAgentsTarget } = require('./paths.js');
const { effectiveSettings, isConfigured } = require('./advisor-settings.js');

const GROUPS = ['workers', 'advisor'];

function relativePath(root, target) {
  return path.relative(root, target).split(path.sep).join('/');
}

function targetEntries(root, artifacts) {
  return artifacts.map((artifact) => {
    const relative = relativePath(root, artifact.target);
    if (!engineArtifacts.validRelativePath(relative)) {
      throw new Error(`refuse to install: unsafe profile target ${artifact.target}`);
    }
    return { ...artifact, path: relative, sha256: engineArtifacts.hash(Buffer.from(artifact.content, 'utf8')) };
  });
}

function manifestPlanFor(useProject, manifestPlan, options = {}) {
  if (manifestPlan) return manifestPlan;
  const manifestFile = installManifestTarget(useProject, options.projectRoot);
  const state = engineArtifacts.manifestState(manifestFile);
  return { ...state, manifestFile, manifestExists: state.exists };
}

function addPath(set, relative) {
  if (engineArtifacts.validRelativePath(relative)) set.add(relative);
}

function removeFile(root, relative) {
  const target = path.join(root, ...relative.split('/'));
  try { fs.unlinkSync(target); } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return;
  }
  let directory = path.dirname(target);
  while (directory !== root && directory.startsWith(`${root}${path.sep}`)) {
    try { fs.rmdirSync(directory); } catch { break; }
    directory = path.dirname(directory);
  }
}

function preflight(useProject, action, suppliedManifestPlan, options = {}) {
  if (action !== 'install' && action !== 'uninstall') throw new Error(`unsupported profile action: ${action}`);
  const selectedGroups = options.groups || GROUPS;
  const root = openCodeRootTarget(useProject, options.projectRoot);
  const manifestPlan = manifestPlanFor(useProject, suppliedManifestPlan, options);
  const workerProfiles = selectedGroups.includes('workers')
    ? targetEntries(root, agents.profiles(useProject, options.projectRoot))
    : [];
  let advisorProfilesToWrite = [];
  if (selectedGroups.includes('advisor')) {
    try {
      advisorProfilesToWrite = targetEntries(root, advisorProfiles.artifacts(useProject, options));
    } catch (error) {
      // Uninstall ownership comes from the manifest/markers, not mutable settings.
      if (action !== 'uninstall') throw error;
    }
  }
  const entriesByGroup = {};
  for (const group of GROUPS) {
    entriesByGroup[group] = engineArtifacts.readArtifactEntries(manifestPlan.manifest, group);
  }
  const trackedByGroup = Object.fromEntries(GROUPS.map((group) => [
    group,
    entriesByGroup[group] ? new Map(entriesByGroup[group].map((entry) => [entry.path, entry.sha256])) : null,
  ]));
  const desired = { workers: workerProfiles, advisor: advisorProfilesToWrite };
  const desiredByPath = Object.fromEntries(GROUPS.map((group) => [
    group,
    new Map(desired[group].map((artifact) => [artifact.path, artifact.content])),
  ]));

  const seen = new Set();
  for (const group of GROUPS) {
    for (const entry of entriesByGroup[group] || []) {
      if (seen.has(entry.path)) throw new Error(`refuse to use install manifest: profile path is tracked by multiple groups: ${entry.path}`);
      seen.add(entry.path);
    }
  }

  for (const group of selectedGroups) {
    const tracked = trackedByGroup[group];
    if (!tracked) continue;
    for (const [relative, expected] of tracked) {
      const current = engineArtifacts.inspectArtifact(root, relative, action, group);
      if (current && current.sha256 !== expected) {
        const desiredContent = action === 'install' ? desiredByPath[group].get(relative) : undefined;
        if (desiredContent !== undefined && fs.readFileSync(current.target).equals(Buffer.from(desiredContent, 'utf8'))) continue;
        throw new Error(`refuse to ${action}: managed ${group} profile was modified: ${current.target}`);
      }
    }
  }

  const desiredByGroup = Object.fromEntries(GROUPS.map((group) => [
    group,
    new Set(desired[group].map((artifact) => artifact.path)),
  ]));
  if (action === 'install') {
    for (const group of selectedGroups) {
      for (const artifact of desired[group]) {
        for (const otherGroup of GROUPS) {
          if (otherGroup !== group && trackedByGroup[otherGroup]?.has(artifact.path)) {
            throw new Error(`refuse to install: profile target is tracked as ${otherGroup}: ${artifact.target}`);
          }
        }
        const current = engineArtifacts.inspectArtifact(root, artifact.path, action, group);
        if (!current || trackedByGroup[group]?.has(artifact.path)) continue;
        const bytes = fs.readFileSync(current.target);
        const marker = group === 'workers' ? agents.WORKER_MARKER : advisorProfiles.ADVISOR_MARKER;
        if (!bytes.toString('utf8').includes(marker) && !bytes.equals(Buffer.from(artifact.content, 'utf8'))) {
          throw new Error(`refuse to install ${group} profile: ${current.target} exists and is not managed by Guarana`);
        }
      }
    }
  }

  const removePaths = new Set();
  const preserved = [];
  const advisorTargets = [
    ...advisorProfiles.managedTargets(useProject, options),
    { name: 'legacy primary agent', target: legacyAdvisorAgentsTarget(useProject, options.projectRoot) },
  ];
  if (action === 'install') {
    // Drop retired generated paths only when their manifest hash still matches.
    for (const group of selectedGroups) {
      if (group !== 'advisor' && group !== 'workers') continue;
      for (const entry of entriesByGroup[group] || []) {
        if (!desiredByGroup[group].has(entry.path)) addPath(removePaths, entry.path);
      }
    }

    if (selectedGroups.includes('advisor')) {
      for (const artifact of advisorTargets) {
        const relative = relativePath(root, artifact.target);
        if (desiredByGroup.advisor.has(relative)) continue;
        const current = engineArtifacts.inspectArtifact(root, relative, action, 'advisor');
        if (!current) continue;
        const tracked = trackedByGroup.advisor?.has(relative);
        const bytes = fs.readFileSync(current.target);
        const markerOwned = bytes.toString('utf8').includes(advisorProfiles.ADVISOR_MARKER);
        const identicalGenerated = advisorProfilesToWrite.some((generated) => bytes.equals(Buffer.from(generated.content, 'utf8')));
        if (tracked || markerOwned || identicalGenerated) addPath(removePaths, relative);
      }
    }
  } else {
    for (const group of selectedGroups) {
      for (const entry of entriesByGroup[group] || []) addPath(removePaths, entry.path);
    }
    const known = [
      ...workerProfiles.map((artifact) => ({ ...artifact, group: 'workers' })),
      ...advisorProfiles.managedTargets(useProject, options).map((artifact) => ({ ...artifact, group: 'advisor' })),
      { name: 'legacy primary agent', target: legacyAdvisorAgentsTarget(useProject, options.projectRoot), group: 'advisor' },
    ];
    const generatedContents = new Map([
      ...workerProfiles.map((artifact) => [artifact.path, { content: artifact.content, group: 'workers' }]),
      ...advisorProfilesToWrite.map((artifact) => [artifact.path, { content: artifact.content, group: 'advisor' }]),
    ]);
    for (const artifact of known) {
      if (!selectedGroups.includes(artifact.group)) continue;
      const relative = relativePath(root, artifact.target);
      const tracked = trackedByGroup[artifact.group]?.has(relative);
      if (tracked) continue;
      const current = engineArtifacts.inspectArtifact(root, relative, action, artifact.group);
      if (!current) continue;
      const bytes = fs.readFileSync(current.target);
      const marker = artifact.group === 'workers' ? agents.WORKER_MARKER : advisorProfiles.ADVISOR_MARKER;
      const expected = generatedContents.get(relative);
      if (bytes.toString('utf8').includes(marker) || (expected && bytes.equals(Buffer.from(expected.content, 'utf8')))) {
        addPath(removePaths, relative);
      } else {
        preserved.push(current.target);
      }
    }
  }

  const groups = {};
  if (action === 'install') {
    if (selectedGroups.includes('workers')) groups.workers = workerProfiles.map(({ path: relative, sha256 }) => ({ path: relative, sha256 }));
    if (selectedGroups.includes('advisor')) groups.advisor = advisorProfilesToWrite.map(({ path: relative, sha256 }) => ({ path: relative, sha256 }));
  }

  return {
    action,
    root,
    manifestPlan,
    manifestFile: manifestPlan.manifestFile,
    manifest: manifestPlan.manifest,
    manifestExists: manifestPlan.manifestExists ?? manifestPlan.exists,
    selectedGroups,
    workers: workerProfiles,
    advisor: advisorProfilesToWrite,
    advisorTargets,
    removePaths: [...removePaths],
    preserved: [...new Set(preserved)],
    groups,
    setupOnly: action === 'install' && selectedGroups.includes('advisor') && !isConfigured(options.settingsOverride || effectiveSettings(useProject, options)),
  };
}

function applyInstall(plan) {
  for (const relative of plan.removePaths) removeFile(plan.root, relative);
  for (const artifact of [...plan.workers, ...plan.advisor]) {
    fs.mkdirSync(path.dirname(artifact.target), { recursive: true });
    fs.writeFileSync(artifact.target, artifact.content, 'utf8');
  }
}

function applyUninstall(plan) {
  for (const relative of plan.removePaths) removeFile(plan.root, relative);
  return { removed: plan.removePaths.map((relative) => path.join(plan.root, ...relative.split('/'))), preserved: plan.preserved };
}

function installAdvisorArtifactsFromPlan(plan) {
  applyInstall(plan);
  const manifest = plan.manifest || { version: engineArtifacts.MANIFEST_VERSION, engines: {} };
  manifest.advisor = plan.groups.advisor;
  engineArtifacts.writeManifest(plan.manifestFile, manifest);
  return {
    installed: plan.advisor.map(({ name, target }) => ({ name, target })),
    setupOnly: plan.setupOnly,
    skipped: undefined,
  };
}

function installAdvisorArtifacts(useProject, options = {}) {
  const plan = options.preflight || preflight(useProject, 'install', null, { ...options, groups: ['advisor'] });
  return installAdvisorArtifactsFromPlan(plan);
}

function uninstallAdvisorArtifacts(useProject, options = {}) {
  const plan = preflight(useProject, 'uninstall', null, { ...options, groups: ['advisor'] });
  const result = applyUninstall(plan);
  if (plan.manifestExists) {
    const manifest = plan.manifest;
    delete manifest.advisor;
    engineArtifacts.writeManifest(plan.manifestFile, manifest);
  }
  return result;
}

module.exports = { preflight, applyInstall, applyUninstall, installAdvisorArtifacts, installAdvisorArtifactsFromPlan, uninstallAdvisorArtifacts };
