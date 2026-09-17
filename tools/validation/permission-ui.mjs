// Disposable browser harness. Imports the real LinkField; never proxies operational APIs.
import { createServer } from '../../web/node_modules/vite/dist/node/index.js';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../web/', import.meta.url));
const target = new URL('../../web/build/permission-ui/', import.meta.url);
await mkdir(target, { recursive: true });
await writeFile(new URL('main.jsx', target), await readFile(new URL('permission-ui.jsx', import.meta.url)));
await writeFile(new URL('index.html', target), '<html lang="es"><meta charset="utf-8"><title>Ensayo aislado de conexiones</title><div id="root"></div><script type="module" src="/build/permission-ui/main.jsx"></script></html>');
const server = await createServer({
  root, configFile: false,
  cacheDir: 'node_modules/.vite-permission-ui',
  optimizeDeps: { entries: ['build/permission-ui/index.html'] },
  server: { host: '127.0.0.1', port: 63117, strictPort: true },
  plugins: [{ name: 'reject-operational-api', configureServer(instance) {
    instance.middlewares.use('/api', (_req, res) => {
      res.statusCode = 503;
      res.end('Real API access is disabled in this test harness');
    });
  } }],
});
await server.listen();
console.log('Synthetic UI harness: http://127.0.0.1:63117/build/permission-ui/index.html');
