import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { DEFAULT_PORT, PORT_ENV } from './lib/constants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = process.cwd();
const distDir = path.join(__dirname, '..', 'web', 'dist');
const PORT = process.env[PORT_ENV] || DEFAULT_PORT;

const app = createApp({ root, distDir });

app.listen(PORT, () => {
  console.log(`guarana dashboard listening on http://localhost:${PORT}`);
  console.log(`project root: ${root}`);
});
