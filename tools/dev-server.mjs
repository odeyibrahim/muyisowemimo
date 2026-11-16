// Local preview server for the static site.
// Serves `public/` as the document root so root-absolute asset paths
// (/css/site.css, /js/boot.js, /logo.svg) resolve exactly as they do on Netlify.
// Opening public/index.html straight from disk cannot work: "/css/site.css"
// resolves to the drive root in a file:// URL. Always preview through this server.
// Usage: npm run dev   (then open http://localhost:8888)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const port = Number(process.env.PORT || 8888);

const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8', ...headers });
  res.end(body);
}

http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    return send(res, 400, 'Bad request');
  }
  if (pathname.includes('\0')) return send(res, 400, 'Bad request');

  // Resolve inside root only; reject traversal.
  const target = path.resolve(root, '.' + pathname);
  const relative = path.relative(root, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return send(res, 403, 'Forbidden');

  fs.stat(target, (err, stat) => {
    if (!err && stat.isDirectory()) return serveFile(path.join(target, 'index.html'));
    if (!err) return serveFile(target);
    // Extensionless route: /admin -> /admin/index.html (mirrors netlify.toml).
    if (!path.extname(target)) return serveFile(path.join(target, 'index.html'));
    return send(res, 404, 'Not found: ' + pathname);
  });

  function serveFile(file) {
    fs.readFile(file, (err, buf) => {
      if (err) {
        console.log('404', pathname);
        return send(res, 404, 'Not found: ' + pathname);
      }
      res.writeHead(200, {
        'content-type': types[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'cache-control': 'no-store',
      });
      res.end(buf);
      console.log('200', pathname);
    });
  }
}).listen(port, () => {
  console.log(`Site:  http://localhost:${port}/`);
  console.log(`Admin: http://localhost:${port}/admin/`);
  console.log(`Root:  ${root}`);
  console.log('Public pages are the static snapshot; the live site renders them from Supabase.');
});
