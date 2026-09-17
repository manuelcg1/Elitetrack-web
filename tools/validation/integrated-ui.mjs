import { createServer } from '../../web/node_modules/vite/dist/node/index.js';
import svgr from '../../web/node_modules/vite-plugin-svgr/dist/index.js';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const backend = (await readFile(new URL('../../build/geofence-browser-server.txt', import.meta.url), 'utf8')).trim();
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(backend)) throw new Error('Refusing non-loopback backend');
await readFile(new URL('../../build/geofence-browser-running', import.meta.url));
const root = fileURLToPath(new URL('../../web/', import.meta.url));
const target = new URL('../../web/build/integrated-ui/', import.meta.url);
await mkdir(target, { recursive: true });
await writeFile(new URL('main.jsx', target), await readFile(new URL('integrated-ui.jsx', import.meta.url)));
await writeFile(new URL('index.html', target), '<html lang="es"><meta charset="utf-8"><title>Ensayo integrado aislado</title><div id="root"></div><script type="module" src="/build/integrated-ui/main.jsx"></script></html>');
const server = await createServer({ root, configFile: false, plugins: [svgr()],
  cacheDir: 'node_modules/.vite-integrated-ui',
  optimizeDeps: { entries: ['build/integrated-ui/index.html'] },
  server: { host: '127.0.0.1', port: 63118, strictPort: true, proxy: { '/api': backend } },
});
await server.listen();
console.log('Integrated fixture: http://127.0.0.1:63118/build/integrated-ui/index.html');
