import fs from 'fs';
import DEFAULTS from '../netlify/functions/_lib/defaults.js';
import { layout, renderBlocks } from '../netlify/functions/_lib/render.js';
const s = DEFAULTS.settings, page = DEFAULTS.pages.home;
const html = layout({ settings: s, slug: 'home', body: renderBlocks(page.blocks, { slug: 'home', settings: s, posts: [] }), canonical: 'https://www.muyi-sowemimolegal.com/', title: page.seo_title || `${page.title} — ${s.firm}`, desc: page.seo_description || s.tagline });
fs.writeFileSync(new URL('../public/index.html', import.meta.url), '<!-- Static snapshot of the home page (default content). On the live site "/" is served by the site function so Site Manager edits appear; this file is the Netlify-recognised index and a safe fallback. Regenerate with: node tools/prerender-index.mjs -->\n' + html);
console.log('index.html', html.length);
