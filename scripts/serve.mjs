import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const port = Number(process.env.PORT || 4179);
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.wasm':'application/wasm','.onnx':'application/octet-stream','.webp':'image/webp','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.py':'text/plain; charset=utf-8','.md':'text/plain; charset=utf-8','.txt':'text/plain; charset=utf-8','.zip':'application/zip'};
const server = createServer(async (request, response) => {
  try {
    let pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname === '/lab-07') { response.writeHead(301, {Location:'/lab-07/'}); response.end(); return; }
    if (pathname.startsWith('/lab-07/')) pathname = pathname.slice('/lab-07'.length);
    if (pathname.split('/').some(part => part.startsWith('.') && part !== '.nojekyll')) throw Error('Forbidden');
    let path = resolve(root, '.' + pathname);
    if (path !== root && !path.startsWith(root + sep)) throw Error('Forbidden');
    if ((await stat(path)).isDirectory()) path = resolve(path, 'index.html');
    const body = await readFile(path);
    response.writeHead(200, {'Content-Type':types[extname(path)] || 'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch { response.writeHead(404); response.end('Not found'); }
});
server.listen(port, '127.0.0.1', () => console.log(`Lab 7 preview: http://127.0.0.1:${port}/lab-07/`));
for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
