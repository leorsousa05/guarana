import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { DEFAULT_PORT, PORT_ENV } from './lib/constants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = process.cwd();
const distDir = path.join(__dirname, '..', 'web', 'dist');
const PORT = process.env[PORT_ENV] || DEFAULT_PORT;
const HOST = '127.0.0.1';

const app = createApp({ root, distDir });

app.listen(PORT, HOST, () => {
  console.log(`guarana dashboard listening on http://${HOST}:${PORT}`);
  console.log(`project root: ${root}`);
});
