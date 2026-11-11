// Builds demo/cms-demo.html: ONE standalone file (open it by double-clicking) containing the real Site Manager UI,
// the real page renderer + schema + default content, and an in-browser mock of the database.
// Re-run after changing the site:   node demo/build-demo.mjs
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..'), r = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const L = 'netlify/functions/_lib/';
const strip = (s) => s.replace(/^import .*$/gm, '').replace(/^export default /m, 'const DEFAULTS = ').replace(/^export (const|function|async function) /gm, '$1 ');
const dbHelpers = r(L + 'db.js').split('\n').filter((l) => /^export const (clip|isUuid|safeHref|slugify)/.test(l)).map((l) => l.replace('export ', '')).join('\n');
const logoUri = 'data:image/svg+xml;base64,' + Buffer.from(r('public/logo.svg')).toString('base64');
const bundle = [dbHelpers, strip(r(L + 'schema.js')), strip(r(L + 'defaults.js')), strip(r(L + 'render.js')),
  'const ASSETS = ' + JSON.stringify({ css: r('public/css/site.css'), boot: r('public/js/boot.js'), site: r('public/js/site.js'), logo: logoUri }) + ';',
  r('demo/mock-api.js')].join('\n');
const admin = r('public/admin/admin.js').replaceAll("'/logo.svg'", JSON.stringify(logoUri));
const esc = (s) => s.replace(/<\/script/gi, '<\\/script');
const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Site Manager DEMO — Muyi Sowemimo &amp; Co.</title><meta name="robots" content="noindex,nofollow"><link rel="icon" href="${logoUri}" type="image/svg+xml">
<style>${r('public/admin/admin.css')}</style></head><body><div id="app"><p class="boot">Loading…</p></div><div id="toasts" aria-live="polite"></div>
<script>(function(){${esc(bundle)}\n})();</script>
<script>${esc(admin)}</script></body></html>`;
fs.writeFileSync(path.join(root, 'demo/cms-demo.html'), html); console.log('demo/cms-demo.html', Math.round(html.length / 1024) + ' KB');
