import { db, safeHref } from './_lib/db.js';
import { PAGES } from './_lib/schema.js';
import DEFAULTS from './_lib/defaults.js';
import { esc, rt, layout, renderBlocks } from './_lib/render.js';

const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: https:; frame-src https://www.google.com; connect-src 'self'; form-action 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'";
const out = (code, body, type = 'text/html; charset=utf-8') => ({ statusCode: code, body, headers: { 'Content-Type': type, 'Content-Security-Policy': CSP, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'public, max-age=60' } });
const withTimeout = (p, ms = 3000) => Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error('db timeout')), ms))]);
const SITE = () => (process.env.SITE_URL || '').replace(/\/$/, '');
const fmt = (d) => new Date(d || Date.now()).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

async function loadAll(slug) {
  const res = { pages: {}, settings: null, posts: [], ok: true };
  try {
    const sb = db();
    const [pg, ps] = await withTimeout(Promise.all([
      sb.from('site_pages').select('slug,content').in('slug', [slug, '_site']),
      sb.from('posts').select('slug,title,excerpt,cover_url,category,published_at').eq('is_published', true).order('published_at', { ascending: false }).limit(100)]));
    for (const r of pg.data || []) { if (r.slug === '_site') res.settings = r.content; else res.pages[r.slug] = r.content; }
    res.posts = ps.data || [];
  } catch (e) { console.error('site: using bundled defaults —', e.message); res.ok = false; }
  return res;
}

export const handler = async (e) => {
  const q = e.queryStringParameters || {}; let slug = String(q.slug || 'home').toLowerCase();
  try {
    if (slug === 'sitemap') {
      let posts = [], hidden = new Set();
      try { const sb = db(); const [a, b] = await withTimeout(Promise.all([sb.from('posts').select('slug,updated_at').eq('is_published', true), sb.from('site_pages').select('slug,content')])); posts = a.data || []; (b.data || []).forEach((r) => r.content?.hidden && hidden.add(r.slug)); } catch (err) { console.error(err.message); }
      const urls = [...PAGES.filter((p) => !hidden.has(p.slug)).map((p) => [p.path, null]), ...posts.map((p) => [`/insights/${encodeURIComponent(p.slug)}`, p.updated_at])];
      return out(200, `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(([u, m]) => `<url><loc>${esc(SITE() + u)}</loc>${m ? `<lastmod>${new Date(m).toISOString()}</lastmod>` : ''}</url>`).join('')}</urlset>`, 'application/xml');
    }
    const meta = PAGES.find((p) => p.slug === slug);
    if (!meta) return notFound();
    const d = await loadAll(slug);
    const settings = { ...DEFAULTS.settings, ...(d.settings || {}) };
    const page = d.pages[slug] || DEFAULTS.pages[slug];
    if (page.hidden) return notFound(settings);
    const ctx = { slug, settings, posts: d.posts };

    if (slug === 'insights' && q.post) {
      let p = null;
      try { const { data } = await withTimeout(db().from('posts').select('*').eq('slug', q.post).eq('is_published', true).maybeSingle()); p = data; } catch (err) { console.error(err.message); }
      if (!p) return notFound(settings);
      const img = /^https:\/\//.test(p.cover_url || '') ? p.cover_url : '';
      const mins = Math.max(1, Math.round(String(p.body).split(/\s+/).length / 200));
      const body = `<article class="article"><div class="wrap narrow"><p class="kick"><a href="/insights">Insights</a> · ${esc(p.category || 'Briefing')}</p><h1 class="display">${esc(p.title)}</h1><p class="meta">${esc(fmt(p.published_at))} · ${mins} min read</p>${img ? `<img class="cover" src="${esc(img)}" alt="">` : ''}<div class="rt">${rt(p.body)}</div><p class="back"><a href="/insights">← All insights</a></p></div></article>`;
      const canonical = `${SITE()}/insights/${encodeURIComponent(p.slug)}`;
      return out(200, layout({ settings, slug, body, canonical, title: `${p.title} — ${settings.firm}`, desc: p.excerpt || p.title, image: img,
        ld: { '@context': 'https://schema.org', '@type': 'Article', headline: p.title, datePublished: p.published_at, dateModified: p.updated_at, publisher: { '@type': 'Organization', name: settings.firm } } }));
    }
    const ld = slug === 'home' ? { '@context': 'https://schema.org', '@type': 'LegalService', name: settings.firm, url: SITE(), telephone: settings.phone, email: settings.email,
      address: (settings.offices || []).map((o) => ({ '@type': 'PostalAddress', streetAddress: o.address, addressCountry: 'NG' })) } : null;
    return out(200, layout({ settings, slug, body: renderBlocks(page.blocks, ctx), canonical: SITE() + meta.path, title: page.seo_title || `${page.title} — ${settings.firm}`, desc: page.seo_description || settings.tagline, ld }));
  } catch (err) { console.error(err); return out(500, '<p>Something went wrong. Please try again shortly.</p>'); }
};
function notFound(settings = DEFAULTS.settings) {
  const body = `<section class="hero hero--page"><div class="wrap"><p class="kick">404</p><h1 class="display">Page not <span class="acc">found</span></h1><p class="lead"><a href="/">Return to the home page</a></p></div></section>`;
  return { ...out(404, layout({ settings, slug: '', body, canonical: SITE(), title: `Page not found — ${settings.firm}`, desc: '' })), };
}
