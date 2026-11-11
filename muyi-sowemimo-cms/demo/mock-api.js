// ===== DEMO BACKEND: stands in for Netlify Functions + Supabase, entirely inside the browser =====
const DEMO_USER = 'demo', DEMO_PASS = 'demo1234', DEMO_TOKEN = 'demo-token', LS = 'ms_demo_v1';
const clone = (o) => JSON.parse(JSON.stringify(o));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(16).slice(2) + Date.now());
const ago = (d) => new Date(Date.now() - d * 864e5).toISOString();
function seed() {
  return { pages: {}, versions: [], media: [], users: [],
    posts: [
      { id: uid(), slug: 'what-inbound-investors-should-ask-before-entering-nigeria', title: 'What inbound investors should ask before entering Nigeria', category: 'Cross-border', excerpt: 'Five questions that decide whether a Nigerian venture is structured to last.', body: 'Placeholder briefing for demonstration.\n\n## 1. Which vehicle fits the activity?\nThe choice of vehicle drives licensing, taxation and the exit.\n\n## 2. Who holds the permits?\nSector permits are often issued to a specific entity; confirm before signing.', cover_url: null, is_published: true, published_at: ago(5), created_at: ago(5), updated_at: ago(5) },
      { id: uid(), slug: 'mining-and-energy-permitting-what-changes-for-operators', title: 'Mining and energy permitting: what changes for operators', category: 'Energy & Mining', excerpt: 'A plain-language read-out of recent regulatory movement.', body: 'Placeholder briefing for demonstration.\n\n## What changed\nSummarise the development here.\n\n## What it means\nExplain the practical consequence for operators and investors.', cover_url: null, is_published: true, published_at: ago(14), created_at: ago(14), updated_at: ago(14) },
      { id: uid(), slug: 'draft-estate-planning-for-diaspora-families', title: 'Estate planning for diaspora families (draft)', category: 'Private Client', excerpt: 'A draft to show how unpublished articles look.', body: 'Work in progress.', cover_url: null, is_published: false, published_at: null, created_at: ago(1), updated_at: ago(1) }
    ],
    enquiries: [
      { id: uid(), type: 'referral', name: 'J. Whitfield', email: 'j.whitfield@example.com', phone: '+44 20 7946 0000', org: 'Whitfield & Partners, London', subject: 'Joint venture — Ogun State', message: 'We act for a UK investor and need local co-counsel for a property joint venture. Could we speak this week?', status: 'new', created_at: ago(0.2) },
      { id: uid(), type: 'general', name: 'A. Balogun', email: 'a.balogun@example.com', phone: '', org: '', subject: 'Company registration', message: 'I would like advice on registering a company in Abeokuta.', status: 'handled', created_at: ago(3) }
    ] };
}
let S; try { S = JSON.parse(localStorage.getItem(LS)); } catch (e) { S = null; } if (!S || !S.pages) S = seed();
const save = () => { try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) { /* storage full or blocked: demo keeps working in memory */ } };
window.__demoReset = () => { try { localStorage.removeItem(LS); sessionStorage.clear(); } catch (e) { /* ignore */ } location.reload(); };
const validSlug = (s) => s === '_site' || PAGES.some((p) => p.slug === s);
const J = (code, obj) => new Response(JSON.stringify(obj), { status: code, headers: { 'Content-Type': 'application/json' } });
function saveVersion(slug, content, by) { S.versions.push({ id: uid(), slug, content: clone(content), saved_by: by, created_at: new Date().toISOString() }); const mine = S.versions.filter((v) => v.slug === slug); if (mine.length > 25) { const drop = new Set(mine.slice(0, mine.length - 25).map((v) => v.id)); S.versions = S.versions.filter((v) => !drop.has(v.id)); } }
const bytes = (b64) => { try { return atob(b64); } catch (e) { return ''; } };

async function adminOp(op, data, token) {
  if (op === 'login') {
    const u = String(data.username || '').trim().toLowerCase(), p = String(data.password || '');
    if (u === DEMO_USER && p === DEMO_PASS) return J(200, { success: true, token: DEMO_TOKEN, username: 'demo', role: 'owner' });
    const ed = S.users.find((x) => x.username === u && x.active && x.password === p);
    if (ed) return J(200, { success: true, token: 'demo-editor-' + u, username: u, role: 'editor' });
    return J(401, { error: 'Credentials not recognised.' });
  }
  if (!token || !/^demo-/.test(token)) return J(401, { error: 'Authentication required' });
  const me = token === DEMO_TOKEN ? { username: 'demo', role: 'owner' } : { username: token.replace('demo-editor-', ''), role: 'editor' }, owner = me.role === 'owner';
  switch (op) {
    case 'logout': return J(200, { success: true });
    case 'me': return J(200, me);
    case 'get_schema': return J(200, { BLOCKS, SETTINGS, PAGES });
    case 'get_site': return J(200, { pages: PAGES.map((p) => ({ ...p, edited: !!S.pages[p.slug], updated_at: S.pages[p.slug]?.updated_at, updated_by: S.pages[p.slug]?.updated_by })), settings_edited: !!S.pages._site });
    case 'get_page': { if (!validSlug(data.slug)) return J(400, { error: 'Unknown page' }); const r = S.pages[data.slug]; return J(200, { content: clone(r ? r.content : (data.slug === '_site' ? DEFAULTS.settings : DEFAULTS.pages[data.slug])), edited: !!r }); }
    case 'save_page': { if (!validSlug(data.slug)) return J(400, { error: 'Unknown page' }); const content = data.slug === '_site' ? cleanSettings(data.content) : cleanPage(data.content); S.pages[data.slug] = { content, updated_at: new Date().toISOString(), updated_by: me.username }; saveVersion(data.slug, content, me.username); save(); return J(200, { success: true, content }); }
    case 'reset_page': { delete S.pages[data.slug]; save(); return J(200, { success: true }); }
    case 'get_versions': return J(200, S.versions.filter((v) => v.slug === data.slug).sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, 25).map(({ id, created_at, saved_by }) => ({ id, created_at, saved_by })));
    case 'restore_version': { const v = S.versions.find((x) => x.id === data.id); if (!v) return J(404, { error: 'Version not found' }); S.pages[v.slug] = { content: clone(v.content), updated_at: new Date().toISOString(), updated_by: me.username }; saveVersion(v.slug, v.content, me.username); save(); return J(200, { success: true, slug: v.slug }); }
    case 'get_posts': return J(200, clone(S.posts).sort((a, b) => (a.created_at < b.created_at ? 1 : -1)));
    case 'save_post': {
      if (!clip(data.title, 200)) return J(400, { error: 'Title is required' });
      const slug = slugify(data.slug || data.title) || 'article-' + Date.now().toString(36), pub = !!data.is_published;
      if (S.posts.some((p) => p.slug === slug && p.id !== data.id)) return J(409, { error: 'That URL slug is already used by another article.' });
      const row = { slug, title: clip(data.title, 200), category: clip(data.category, 60) || 'Briefing', excerpt: clip(data.excerpt, 400), body: String(data.body || '').slice(0, 100000), cover_url: /^https:\/\/|^data:image\//.test(data.cover_url || '') ? String(data.cover_url).slice(0, 2000000) : null, is_published: pub, updated_at: new Date().toISOString() };
      if (pub) row.published_at = data.published_at && !isNaN(Date.parse(data.published_at)) ? new Date(data.published_at).toISOString() : new Date().toISOString();
      let saved; const ex = data.id && S.posts.find((p) => p.id === data.id);
      if (ex) { Object.assign(ex, row); saved = ex; } else { saved = { id: uid(), created_at: new Date().toISOString(), published_at: null, ...row }; S.posts.push(saved); }
      save(); return J(200, clone(saved));
    }
    case 'delete_post': S.posts = S.posts.filter((p) => p.id !== data.id); save(); return J(200, { success: true });
    case 'list_media': return J(200, clone(S.media).reverse());
    case 'upload_image': {
      const raw = bytes(String(data.data || '')); if (raw.length < 100 || raw.length > 3 * 1024 * 1024) return J(400, { error: 'Image must be under 3 MB.' });
      const m = { id: uid(), url: 'data:image/jpeg;base64,' + data.data, name: clip(data.name, 120) || 'image.jpg', size: raw.length, created_at: new Date().toISOString() };
      S.media.push(m); save(); return J(200, { url: m.url, media: { ...m } });
    }
    case 'delete_media': S.media = S.media.filter((m) => m.id !== data.id); save(); return J(200, { success: true });
    case 'get_enquiries': return J(200, clone(S.enquiries).sort((a, b) => (a.created_at < b.created_at ? 1 : -1)));
    case 'update_enquiry': { if (!['new', 'handled'].includes(data.status)) return J(400, { error: 'Invalid status' }); const e = S.enquiries.find((x) => x.id === data.id); if (e) e.status = data.status; save(); return J(200, { success: true }); }
    case 'delete_enquiry': S.enquiries = S.enquiries.filter((e) => e.id !== data.id); save(); return J(200, { success: true });
    case 'list_users': if (!owner) return J(403, { error: 'Owner only' }); return J(200, S.users.map(({ username, role, active, created_at }) => ({ username, role, active, created_at })));
    case 'save_user': {
      if (!owner) return J(403, { error: 'Owner only' }); const username = clip(data.username, 40).toLowerCase(); if (!/^[a-z0-9._-]{3,40}$/.test(username)) return J(400, { error: 'Username: 3–40 letters, numbers, . _ -' });
      let u = S.users.find((x) => x.username === username);
      if (data.password && String(data.password).length < 10) return J(400, { error: 'Password must be at least 10 characters.' });
      if (!u) { if (!data.password) return J(400, { error: 'A password is required for a new user.' }); u = { username, role: 'editor', active: true, created_at: new Date().toISOString() }; S.users.push(u); }
      if (data.password) u.password = String(data.password); if (data.active !== undefined) u.active = data.active !== false; save(); return J(200, { success: true });
    }
    case 'delete_user': if (!owner) return J(403, { error: 'Owner only' }); S.users = S.users.filter((u) => u.username !== data.username); save(); return J(200, { success: true });
    default: return J(400, { error: 'Invalid operation' });
  }
}
function enquiry(b) {
  const row = { id: uid(), type: b.type === 'referral' ? 'referral' : 'general', name: clip(b.name, 120), email: clip(b.email, 160), phone: clip(b.phone, 40), org: clip(b.org, 160), subject: clip(b.subject, 160), message: clip(b.message, 4000), status: 'new', created_at: new Date().toISOString() };
  if (!row.name || !row.message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email) || (row.type === 'referral' && !row.org)) return J(400, { error: 'Please complete the required fields with a valid email address.' });
  S.enquiries.push(row); save(); return J(200, { success: true });
}
const realFetch = window.fetch.bind(window);
window.fetch = async (url, opts) => {
  const u = String(url);
  if (u.indexOf('/.netlify/functions/admin-operations') >= 0) {
    let body = {}; try { body = JSON.parse(opts.body); } catch (e) { /* ignore */ }
    const t = opts.headers && (opts.headers['X-Admin-Token'] || opts.headers['x-admin-token']);
    return adminOp(body.operation, body.data || {}, t);
  }
  if (u.indexOf('/.netlify/functions/submit-enquiry') >= 0) { let b = {}; try { b = JSON.parse(opts.body); } catch (e) { /* ignore */ } return enquiry(b); }
  return realFetch(url, opts);
};

// ===== LIVE PREVIEW: renders the real public page (same renderer the live site uses) inside the demo =====
function renderPath(path) {
  const settings = { ...DEFAULTS.settings, ...((S.pages._site && S.pages._site.content) || {}) };
  const posts = S.posts.filter((p) => p.is_published).sort((a, b) => (a.published_at < b.published_at ? 1 : -1));
  const parts = String(path || '/').split('?')[0].replace(/\/$/, '').split('/').filter(Boolean);
  const slug = parts.length ? parts[0] : 'home'; const meta = PAGES.find((p) => p.slug === slug);
  const fmt = (d) => new Date(d || Date.now()).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const nf = (msg) => layout({ settings, slug: '', title: 'Not found — ' + settings.firm, desc: '', canonical: '', body: '<section class="hero hero--page"><div class="wrap"><p class="kick">404</p><h1 class="display">' + esc(msg) + '</h1><p class="lead"><a href="/">Return to the home page</a></p></div></section>' });
  if (!meta) return nf('Page not found');
  const page = (S.pages[slug] && S.pages[slug].content) || DEFAULTS.pages[slug];
  if (page.hidden) return nf('Page not found');
  if (slug === 'insights' && parts[1]) {
    const p = posts.find((x) => x.slug === decodeURIComponent(parts[1])); if (!p) return nf('Article not found');
    const mins = Math.max(1, Math.round(String(p.body).split(/\s+/).length / 200));
    return layout({ settings, slug, title: p.title + ' — ' + settings.firm, desc: p.excerpt || p.title, canonical: '', body: '<article class="article"><div class="wrap narrow"><p class="kick"><a href="/insights">Insights</a> · ' + esc(p.category || 'Briefing') + '</p><h1 class="display">' + esc(p.title) + '</h1><p class="meta">' + esc(fmt(p.published_at)) + ' · ' + mins + ' min read</p>' + (/^(https:|data:image)/.test(p.cover_url || '') ? '<img class="cover" src="' + esc(p.cover_url) + '" alt="">' : '') + '<div class="rt">' + rt(p.body) + '</div><p class="back"><a href="/insights">← All insights</a></p></div></article>' });
  }
  return layout({ settings, slug, body: renderBlocks(page.blocks, { slug, settings, posts }), title: page.seo_title || (page.title + ' — ' + settings.firm), desc: page.seo_description || settings.tagline, canonical: '' });
}
function previewDoc(path) {
  let h = renderPath(path);
  h = h.replace('<script src="/js/boot.js"></script>', '<script>' + ASSETS.boot + '</script>')
    .replace('<link rel="stylesheet" href="/css/site.css">', '<style>' + ASSETS.css + '</style>')
    .replace(/\/logo\.svg/g, ASSETS.logo).replace(/\/favicon\.svg/g, ASSETS.logo)
    .replace('<script src="/js/site.js"></script>', '<script>window.fetch=function(){return parent.fetch.apply(parent,arguments)};' + ASSETS.site + '\ndocument.addEventListener("click",function(e){var a=e.target.closest&&e.target.closest("a");if(!a)return;var h=a.getAttribute("href")||"";if(h.charAt(0)==="/"&&h.charAt(1)!=="/"){e.preventDefault();parent.postMessage({demoNav:h},"*")}});<\/script>');
  return h;
}
let frame, bar, titleEl;
function openPreview(path) {
  if (!frame) {
    const wrap = document.createElement('div'); wrap.id = 'demo-prev'; wrap.style.cssText = 'position:fixed;inset:0;z-index:9000;background:#fff;display:none;flex-direction:column';
    bar = document.createElement('div'); bar.style.cssText = 'display:flex;align-items:center;gap:12px;padding:10px 16px;background:#1d0a0e;color:#fff;font:600 13px system-ui';
    titleEl = document.createElement('span'); titleEl.style.flex = '1';
    const x = document.createElement('button'); x.textContent = '✕ Close preview'; x.style.cssText = 'background:#7a1020;color:#fff;border:0;padding:8px 14px;font:600 13px system-ui;cursor:pointer'; x.onclick = () => { wrap.style.display = 'none'; frame.srcdoc = ''; };
    bar.append(titleEl, x); frame = document.createElement('iframe'); frame.style.cssText = 'flex:1;border:0;width:100%;background:#fff'; wrap.append(bar, frame); document.body.append(wrap);
    window.addEventListener('message', (e) => { if (e.data && e.data.demoNav) openPreview(e.data.demoNav); });
  }
  titleEl.textContent = 'Preview of ' + (path || '/') + ' — this is how visitors would see your saved changes';
  frame.srcdoc = previewDoc(path); frame.parentNode.style.display = 'flex';
}
document.addEventListener('click', (e) => { const a = e.target.closest && e.target.closest('a[target=_blank]'); if (!a) return; const h = a.getAttribute('href') || ''; if (h.charAt(0) === '/') { e.preventDefault(); openPreview(h); } }, true);

// ===== Demo banner =====
const banner = document.createElement('div');
banner.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:9500;background:#fff;border:1px solid #d9d2c5;box-shadow:0 6px 24px rgba(0,0,0,.18);padding:10px 14px;font:13px/1.45 system-ui;color:#2d2a2a;max-width:320px';
banner.innerHTML = '<b style="color:#7a1020">DEMO MODE</b> — nothing here touches a real site; changes stay in this browser.<br>Login: <code>demo</code> / <code>demo1234</code> · <a href="#" id="demo-reset" style="color:#7a1020">Reset demo data</a>';
const fix = document.createElement('style'); fix.textContent = '#toasts{bottom:auto!important;top:16px!important}'; document.head.append(fix);
document.body.append(banner); document.getElementById('demo-reset').onclick = (e) => { e.preventDefault(); if (confirm('Reset all demo data?')) window.__demoReset(); };
