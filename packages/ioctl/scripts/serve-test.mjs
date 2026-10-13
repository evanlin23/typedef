// Deliberately omit COOP/COEP headers to exercise the static-host service worker.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { extname, resolve, sep } from 'node:path';
const root = fileURLToPath(new URL('../dist/', import.meta.url));
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm', '.css': 'text/css', '.svg': 'image/svg+xml' };
createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (!pathname.startsWith('/ioctl/')) { response.writeHead(404).end(); return; }
    const relative = pathname.slice('/ioctl/'.length);
    const path = resolve(root, relative);
    if (!path.startsWith(root.endsWith(sep) ? root : root + sep)) { response.writeHead(403).end(); return; }
    let bytes;
    let extension = extname(path);
    try { bytes = await readFile(path); }
    catch {
      if (extension) { response.writeHead(404).end(); return; }
      bytes = await readFile(resolve(root, 'index.html'));
      extension = '.html';
    }
    response.writeHead(200, { 'Content-Type': mime[extension] || 'application/octet-stream' });
    response.end(bytes);
  } catch { response.writeHead(500).end(); }
}).listen(4175, '127.0.0.1');
