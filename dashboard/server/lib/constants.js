// Shared constants for the guarana dashboard server.
// Centralizing these avoids magic numbers/strings duplicated in server, CLI, and tests.

export const DEFAULT_PORT = 4200;
export const PORT_ENV = 'GUARANA_DASH_PORT';

export const SPECS_DIR = '.specs';
export const TELEMETRY_DIR_SEGMENTS = ['state', 'telemetry'];
export const EVENTS_FILE = 'events.jsonl';
