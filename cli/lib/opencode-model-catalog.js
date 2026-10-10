'use strict';

const { execFile: childExecFile } = require('node:child_process');

const COMMAND_TIMEOUT_MS = 15000;
const MAX_OUTPUT_BYTES = 128 * 1024;
const VARIANT_COMMAND_TIMEOUT_MS = 10000;
const MAX_VARIANT_OUTPUT_BYTES = 2 *  1024 * 1024;
const PROVIDER_ID = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,127}$/;
const MODEL_ID = /^[A-Za-z0-9~][A-Za-z0-9._:/+~-]{0,255}$/;
const SECRET_LIKE = /(?:\bsk-[A-Za-z0-9_-]{8,}|\bgh[pousr]_[A-Za-z0-9]{12,}|\bBearer\s+\S+|\b(?:api[_-]?key|token|secret|password)\s*[:=]\s*\S+)/i;
const PROVIDER_LABEL = /^[A-Za-z0-9][A-Za-z0-9 ._+&()'/-]{0,127}$/;
const ANSI_CSI = /\u001B\[[0-?]*[ -/]*[@-~]/g;
const TABLE_DELIMITER = /[|│┃║]/u;
const TABLE_BORDER_ONLY = /^[\s│┃║┌┐└┘├┤┬┴┼─━═╔╗╚╝╠╣╦╩╬╭╮╰╯+|=\-]+$/u;
const BOX_DRAWING_EDGE = /^[│┃║┌┐└┘├┤┬┴┼─━═╔╗╚╝╠╣╦╩╬╭╮╰╯]+|[│┃║┌┐└┘├┤┬┴┼─━═╔╗╚╝╠╣╦╩╬╭╮╰╯]+$/gu;
const PROVIDER_HEADER = /^(?:provider(?:\s+name)?|providers|type|auth|method|status|authentication)$/i;
const CREDENTIALS_HEADER = /^credentials\s+(?:<[^<>]+>|(?:[A-Za-z]:)?[\\/][^\s]+|~[\\/][^\s]+|\.{1,2}[\\/][^\s]+)$/i;
const CREDENTIAL_COUNT = /^\d+\s+credentials?$/i;

function safeText(output, maxBytes = MAX_OUTPUT_BYTES) {
  const raw = typeof output === 'string' ? output : '';
  if (Buffer.byteLength(raw, 'utf8') > maxBytes || SECRET_LIKE.test(raw)) return null;

  const text = raw.replace(ANSI_CSI, '');
  if (SECRET_LIKE.test(text)) return null;
  return text;
}

function failure(error) {
  return { models: [], error };
}

function safeLines(output, kind) {
  const text = safeText(output);
  if (text === null) return null;

  const rows = [];
  for (const raw of text.split(/\r?\n/)) {
    let line = raw.trim();
    if (!line || /^[-=|+\s]+$/.test(line)) continue;
    if (kind === 'providers' && /^(?:authenticated|configured|connected) providers:?$/i.test(line)) continue;
    if (kind === 'models' && /^(?:available )?models:?$/i.test(line)) continue;
    if (kind === 'providers' && /^connected\b/i.test(line)) return null;
    line = line.replace(/^(?:[-*•])\s+/, '');
    if (line.startsWith('|')) line = line.slice(1).split('|')[0].trim();
    else if (kind !== 'models') line = line.split(/\s+/)[0];

    if (/^(?:provider|providers|models?|id)$/i.test(line)) continue;
    if (kind === 'providers' && /^(?:no|none)\b/i.test(line)) continue;
    if (kind === 'models' && line === '*') continue;
    rows.push(line);
  }
  return rows;
}

function parseProviders(output) {
  const text = safeText(output);
  if (text === null) return null;

  const isCredentialsWrapper = (line) => {
    const normalized = line.replace(BOX_DRAWING_EDGE, '').trim();
    return CREDENTIALS_HEADER.test(normalized) || CREDENTIAL_COUNT.test(normalized);
  };

  const labels = [];
  for (const raw of text.split(/\r?\n/)) {
    let line = raw.trim();
    if (!line || TABLE_BORDER_ONLY.test(line)) continue;
    if (isCredentialsWrapper(line)) continue;
    if (/^(?:authenticated|configured|connected) providers:?$/i.test(line)) continue;
    if (/^connected\b/i.test(line)) return null;
    if (/^(?:no|none)\b/i.test(line)) continue;

    const cells = TABLE_DELIMITER.test(line)
      ? line.split(TABLE_DELIMITER).map((cell) => cell.trim()).filter(Boolean)
      : [line.replace(/^(?:[-*•])\s+/, '')];
    if (cells.some(isCredentialsWrapper)) continue;
    if (cells.some((cell) => PROVIDER_HEADER.test(cell))
      || cells.length === 1 && /^(?:(?:provider|providers|type|auth|method|status|authentication)\s*)+$/i.test(cells[0])) continue;

    // A status glyph may have its own cell, while provider and auth method
    // may share a cell ("● OpenAI api") or occupy adjacent cells.
    const candidates = cells.map((cell) => cell
      .replace(/^(?:●|◉|○|✓|✔|☑)\s*/u, '')
      .replace(/\s+(?:api|oauth2?)$/i, '')
      .trim())
      .filter((cell) => cell && !/^(?:api|oauth2?)$/i.test(cell));
    if (candidates.length !== 1 || !PROVIDER_LABEL.test(candidates[0])) return null;
    labels.push(candidates[0]);
  }
  return labels;
}

function normalizedProviderName(value) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function providerLabelMatches(label, providerId) {
  return label.toLowerCase() === providerId.toLowerCase()
    || normalizedProviderName(label) === normalizedProviderName(providerId);
}

function connectedCatalogProviders(labels, catalogProviders) {
  const connected = new Set();
  for (const label of labels) {
    const exact = [...catalogProviders].filter((id) => label.toLowerCase() === id.toLowerCase());
    if (exact.length === 1) {
      connected.add(exact[0]);
      continue;
    }
    const normalized = normalizedProviderName(label);
    const matches = [...catalogProviders].filter((id) => normalizedProviderName(id) === normalized);
    if (matches.length === 1) connected.add(matches[0]);
  }
  return connected;
}

function parseModels(output, authenticatedLabels, providerFilter) {
  const rows = safeLines(output, 'models');
  if (!rows) return null;
  const catalogProviders = new Set();
  const entries = [];
  for (const row of rows) {
    let provider;
    let model;
    const slash = row.indexOf('/');
    if (slash > 0) {
      provider = row.slice(0, slash);
      model = row.slice(slash + 1);
    } else if (providerFilter) {
      provider = providerFilter;
      model = row;
    } else {
      return null;
    }

    if (!PROVIDER_ID.test(provider)) return null;
    if (!authenticatedLabels.some((label) => providerLabelMatches(label, provider)) || (providerFilter && provider !== providerFilter)) continue;
    if (!MODEL_ID.test(model)) return null;
    catalogProviders.add(provider);
    entries.push({ provider, model });
  }

  const connectedProviders = connectedCatalogProviders(authenticatedLabels, catalogProviders);
  const models = new Map();
  for (const { provider, model } of entries) {
    if (!connectedProviders.has(provider) || (providerFilter && provider !== providerFilter)) continue;
    const id = `${provider}/${model}`;
    models.set(id, {
      provider: { id: provider, name: provider },
      model: { id: model, name: model },
    });
  }
  return [...models.values()];
}

function invoke(executable, args, { cwd, execFile, timeout = COMMAND_TIMEOUT_MS, maxOutputBytes = MAX_OUTPUT_BYTES }) {
  return new Promise((resolve) => {
    try {
      execFile(executable, args, {
        cwd,
        timeout,
        maxBuffer: maxOutputBytes,
        windowsHide: true,
        encoding: 'utf8',
        shell: false,
      }, (error, stdout) => {
        if (error) {
          if (error.code === 'ENOENT') return resolve({ error: 'OpenCode is not installed or is not available on PATH.' });
          if (error.code === 'ETIMEDOUT' || error.killed) return resolve({ error: 'OpenCode discovery timed out. Try again or enter model IDs manually.' });
          if (error.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') return resolve({ error: 'OpenCode discovery output exceeded the safe limit.' });
          return resolve({ error: 'An OpenCode discovery command failed. Check OpenCode authentication and try again.' });
        }
        if (Buffer.byteLength(typeof stdout === 'string' ? stdout : '') > maxOutputBytes) {
          return resolve({ error: 'OpenCode discovery output exceeded the safe limit.' });
        }
        resolve({ stdout: typeof stdout === 'string' ? stdout : '' });
      });
    } catch {
      resolve({ error: 'Unable to start an OpenCode discovery command. Check that OpenCode is installed.' });
    }
  });
}

async function discoverModels(options = {}) {
  const { cwd = process.cwd(), provider, execFile = childExecFile } = options;
  if (provider !== undefined && (typeof provider !== 'string' || !PROVIDER_ID.test(provider))) {
    return failure('Provider filter must be a valid OpenCode provider ID.');
  }

  const executable = options.executable || process.env.OPENCODE_BIN || 'opencode';
  const auth = await invoke(executable, ['auth', 'list'], { cwd, execFile });
  if (auth.error) return failure(auth.error);
  const authenticatedLabels = parseProviders(auth.stdout);
  if (!authenticatedLabels) return failure('OpenCode returned malformed provider data; no catalog was exposed.');
  if (authenticatedLabels.length === 0) {
    return failure('No OpenCode providers are connected. Run `opencode auth login` or enter model IDs manually.');
  }
  if (provider && !authenticatedLabels.some((label) => providerLabelMatches(label, provider))) {
    return failure('The requested provider is not connected in OpenCode. Connect it or enter model IDs manually.');
  }

  const args = ['models'];
  if (provider) args.push(provider);
  const catalog = await invoke(executable, args, { cwd, execFile });
  if (catalog.error) return failure(catalog.error);
  const models = parseModels(catalog.stdout, authenticatedLabels, provider);
  if (!models) return failure('OpenCode returned malformed model data; no catalog was exposed.');
  if (models.length === 0) {
    return failure('OpenCode returned no models for connected providers. Enter model IDs manually or check the OpenCode model catalog.');
  }
  return { models, error: null };
}

async function discoverVariants(options = {}) {
  const { cwd = process.cwd(), provider, model, execFile = childExecFile } = options;
  const empty = (error = null) => ({ variants: [], error });
  if (typeof provider !== 'string' || !PROVIDER_ID.test(provider) || typeof model !== 'string' || !MODEL_ID.test(model)) {
    return empty('A valid provider and model ID are required.');
  }
  const executable = options.executable || process.env.OPENCODE_BIN || 'opencode';
  const auth = await invoke(executable, ['auth', 'list'], { cwd, execFile });
  if (auth.error) return empty(auth.error);
  const labels = parseProviders(auth.stdout);
  if (!labels || !labels.some((label) => providerLabelMatches(label, provider))) return empty();
  const result = await invoke(executable, ['models', provider, '--verbose'], {
    cwd, execFile, timeout: VARIANT_COMMAND_TIMEOUT_MS, maxOutputBytes: MAX_VARIANT_OUTPUT_BYTES,
  });
  if (result.error) return empty(result.error);
  const text = safeText(result.stdout, MAX_VARIANT_OUTPUT_BYTES);
  if (text === null) return empty('OpenCode returned unsafe model metadata.');
  try {
    const lines = text.split(/\r?\n/);
    const wanted = `${provider}/${model}`;
    const start = lines.findIndex((line) => line.trim() === wanted);
    if (start < 0) return empty('OpenCode did not return metadata for the requested model.');
    let end = lines.length;
    for (let index = start + 1; index < lines.length; index += 1) {
      if (/^[A-Za-z0-9][A-Za-z0-9._+-]{0,127}\/[A-Za-z0-9~][A-Za-z0-9._:/+~-]{0,255}$/.test(lines[index].trim())) {
        end = index;
        break;
      }
    }
    const definition = JSON.parse(lines.slice(start + 1, end).join('\n').trim());
    if (!definition || typeof definition !== 'object' || !definition.variants || typeof definition.variants !== 'object' || Array.isArray(definition.variants)) return empty();
    const variants = Object.entries(definition.variants)
      .filter(([key, value]) => /^[A-Za-z0-9][A-Za-z0-9._+-]{0,127}$/.test(key) && !(value && typeof value === 'object' && value.disabled === true))
      .map(([key]) => key);
    return { variants, error: null };
  } catch {
    return empty('OpenCode returned malformed variant metadata.');
  }
}

module.exports = { discoverModels, discoverVariants, COMMAND_TIMEOUT_MS, MAX_OUTPUT_BYTES };
