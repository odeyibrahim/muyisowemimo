import { safeHref } from './db.js';
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>')
  .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, t, h) => { const u = safeHref(h.replace(/&amp;/g, '&')); return u ? `<a href="${esc(u)}">${t}</a>` : t; });
// Small, safe rich text: blank line = paragraph, "## " = sub-heading, "- " = bullet, **bold**, *italic*, [text](link)
export function rt(src) {
  const out = []; let list = [], para = [];
  const fl = () => { if (list.length) out.push(`<ul>${list.map((x) => `<li>${inline(x)}</li>`).join('')}</ul>`); list = []; };
  const fp = () => { if (para.length) out.push(`<p>${para.map(inline).join('<br>')}</p>`); para = []; };
  for (const raw of String(src || '').split('\n')) {
    const l = raw.trim();
    if (!l) { fl(); fp(); } else if (l.startsWith('## ')) { fl(); fp(); out.push(`<h3>${inline(l.slice(3))}</h3>`); }
    else if (/^[-·•] /.test(l)) { fp(); list.push(l.slice(2)); } else { fl(); para.push(l); }
  }
  fl(); fp(); return out.join('\n');
}
const btn = (b, i) => { const h = safeHref(b?.href); return b?.label && h ? `<a class="btn${i ? ' btn--ghost' : ''}" href="${esc(h)}">${esc(b.label)}<i aria-hidden="true">›</i></a>` : ''; };
const kick = (k) => (k ? `<p class="kick">${esc(k)}</p>` : '');
const head = (k, h, intro) => (k || h || intro ? `<div class="sect-head rv">${kick(k)}${h ? `<h2 class="display">${esc(h)}</h2>` : ''}${intro ? `<div class="rt">${rt(intro)}</div>` : ''}</div>` : '');
const initials = (n) => String(n).replace(/\b(Mr|Mrs|Dr|Prof)\.?\s/i, '').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const dateFmt = (d) => new Date(d || Date.now()).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
export const mapSrc = (q) => `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed`;

const R = {
  hero: (b, c) => `<section class="hero${c.slug === 'home' ? '' : ' hero--page'}"><div class="wrap hero-grid">
    <div class="hero-l">${kick(b.kicker)}<h1 class="display">${esc(b.headline)} ${b.accent ? `<span class="acc">${esc(b.accent)}</span>` : ''}</h1></div>
    <div class="hero-r"><div class="dots" aria-hidden="true"></div>${b.text ? `<div class="lead rt">${rt(b.text)}</div>` : ''}
      ${(b.buttons || []).some((x) => x.label) ? `<div class="btns">${b.buttons.map(btn).join('')}</div>` : ''}${b.note ? `<p class="note">${esc(b.note)}</p>` : ''}</div>
    ${c.slug === 'home' ? '<div class="hero-tile" aria-hidden="true"><img src="/logo.svg" alt=""><span>Abuja · Abeokuta</span></div>' : ''}</div></section>`,
  strip: (b) => `<section class="strip" aria-label="${esc(b.heading || 'Highlights')}"><div class="strip-in">${(b.items || []).map((x, i) => `<div class="cell"><span>${String(i + 1).padStart(2, '0')}</span><p>${esc(x.title)}</p></div>`).join('')}</div></section>`,
  text: (b) => `<section class="sect"><div class="wrap split"><div class="rv">${kick(b.kicker)}<h2 class="display">${esc(b.heading)}</h2></div><div class="rt rv">${rt(b.body)}</div></div></section>`,
  cards: (b) => `<section class="sect sect--tint"><div class="wrap">${head(b.kicker, b.heading, b.intro)}<div class="cards">${(b.items || []).map((x, i) => `<article class="card rv"><span class="num">${String(i + 1).padStart(2, '0')}</span><h3>${esc(x.title)}</h3><div class="rt">${rt(x.body)}</div></article>`).join('')}</div></div></section>`,
  people: (b) => `<section class="sect"><div class="wrap">${head(b.kicker, b.heading, b.intro)}<div class="people">${(b.items || []).map((x) => `<article class="person rv"><div class="tile" aria-hidden="true"><span>${esc(initials(x.name))}</span></div><div><p class="kick">${esc(x.role)}</p><h3 class="display">${esc(x.name)}</h3><p class="areas">${esc(x.areas)}</p><div class="rt">${rt(x.bio)}</div></div></article>`).join('')}</div></div></section>`,
  offices: (b, c) => `<section class="sect"><div class="wrap">${head(b.kicker, b.heading, b.intro)}${(c.settings.offices || []).map((o) => `<div class="office rv"><div><p class="kick">${esc(o.tag)}</p><h3 class="display">${esc(o.name)}</h3><address>${esc(o.address)}</address><div class="rt">${rt(o.note)}</div></div>${o.map ? `<iframe title="Map: ${esc(o.name)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="${esc(mapSrc(o.map))}"></iframe>` : ''}</div>`).join('')}</div></section>`,
  insights: (b, c) => { const ps = c.posts.slice(0, b.limit || 100); return `<section class="sect sect--tint"><div class="wrap">${head(b.kicker, b.heading, b.intro)}${ps.length ? `<div class="posts">${ps.map((p) => `<a class="post rv" href="/insights/${esc(encodeURIComponent(p.slug))}">${/^https:\/\//.test(p.cover_url || '') ? `<img src="${esc(p.cover_url)}" alt="" loading="lazy">` : '<div class="post-ph" aria-hidden="true"></div>'}<div><p class="kick">${esc(p.category || 'Briefing')} · ${esc(dateFmt(p.published_at))}</p><h3>${esc(p.title)}</h3><p>${esc(p.excerpt)}</p></div></a>`).join('')}</div>` : '<p class="empty">New briefings are published here shortly.</p>'}</div></section>`; },
  band: (b) => `<section class="band"><div class="wrap band-in"><div class="rv"><h2 class="display">${esc(b.heading)}</h2>${b.text ? `<div class="rt">${rt(b.text)}</div>` : ''}</div><div class="btns rv">${(b.buttons || []).map(btn).join('')}</div></div></section>`,
  contact: (b, c) => { const s = c.settings; return `<section class="sect"><div class="wrap contact-grid">
    <div class="rv"><h2 class="display">${esc(b.heading)}</h2><div class="rt">${rt(b.intro)}</div>
      <dl class="details"><dt>Phone</dt><dd><a href="tel:${esc(String(s.phone).replace(/[^+\d]/g, ''))}">${esc(s.phone)}</a></dd><dt>Email</dt><dd><a href="mailto:${esc(s.email)}">${esc(s.email)}</a></dd>${s.hours ? `<dt>Hours</dt><dd>${esc(s.hours)}</dd>` : ''}
      ${(s.offices || []).map((o) => `<dt>${esc(o.name)}</dt><dd>${esc(o.address)}</dd>`).join('')}</dl></div>
    <form class="form rv" data-form="general" novalidate><label>Name<input name="name" required maxlength="120" autocomplete="name"></label><label>Email<input name="email" type="email" required maxlength="160" autocomplete="email"></label>
      <label>Phone <small>(optional)</small><input name="phone" maxlength="40" autocomplete="tel"></label><label>How can we help?<textarea name="message" rows="5" required maxlength="4000"></textarea></label>
      <input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true"><button class="btn" type="submit">Send enquiry<i aria-hidden="true">›</i></button><p class="form-msg" role="status"></p></form></div></section>
    <section class="sect sect--tint" id="referral"><div class="wrap contact-grid"><div class="rv"><h2 class="display">${esc(b.referral_heading)}</h2><div class="rt">${rt(b.referral_intro)}</div></div>
    <form class="form rv" data-form="referral" novalidate><label>Your firm / organisation<input name="org" required maxlength="160"></label><label>Contact name<input name="name" required maxlength="120"></label>
      <label>Email<input name="email" type="email" required maxlength="160"></label><label>Phone <small>(optional)</small><input name="phone" maxlength="40"></label><label>Jurisdiction of the matter<input name="subject" maxlength="160" placeholder="e.g. England &amp; Wales; Nigeria; both"></label>
      <label>Matter summary<textarea name="message" rows="5" required maxlength="4000"></textarea></label><input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true"><button class="btn" type="submit">Submit referral<i aria-hidden="true">›</i></button><p class="form-msg" role="status"></p></form></div></section>`; }
};

export function layout({ page, settings, body, canonical, title, desc, image, ld, slug }) {
  const s = settings; const nav = (s.nav || []).filter((n) => !n.hidden && safeHref(n.href));
  const cta = s.cta?.label && safeHref(s.cta.href) ? `<a class="cta-link" href="${esc(s.cta.href)}"><span></span>${esc(s.cta.label)}<i aria-hidden="true">›</i></a>` : '';
  const active = (h) => (h === '/' + slug || (slug === 'insights' && h === '/insights') ? ' aria-current="page"' : '');
  const offices = (s.offices || []).map((o) => `<p><strong>${esc(o.name)}</strong><br>${esc(o.address)}</p>`).join('');
  return `<!DOCTYPE html><html lang="en-NG"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><script src="/js/boot.js"></script>
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="website"><meta property="og:site_name" content="${esc(s.firm)}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${esc(canonical)}">${image ? `<meta property="og:image" content="${esc(image)}">` : ''}
<meta name="theme-color" content="#6c0c1b"><link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet"><link rel="stylesheet" href="/css/site.css">
${ld ? `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>` : ''}</head><body>
<a class="skip" href="#main">Skip to content</a>
<header class="top"><div class="wrap top-in"><a class="brand" href="/" aria-label="${esc(s.firm)} — home"><img src="/logo.svg" alt="" width="52" height="32"><span><b>MUYI SOWEMIMO</b><small>&amp; CO. · ABUJA · ABEOKUTA</small></span></a>
<nav class="nav" id="nav" aria-label="Main">${nav.map((n) => `<a href="${esc(n.href)}"${active(n.href)}>${esc(n.label)}</a>`).join('')}</nav>${cta}
<button class="burger" id="burger" aria-label="Menu" aria-expanded="false" aria-controls="nav"><span></span><span></span><span></span></button></div></header>
<main id="main">${body}</main>
<footer class="foot"><div class="wrap foot-grid"><div><img src="/logo.svg" alt="" width="64" height="40"><p class="foot-firm">${esc(s.firm)}</p><p>${esc(s.tagline)}</p></div>
<div><h4>Offices</h4>${offices}</div><div><h4>Contact</h4><p><a href="tel:${esc(String(s.phone).replace(/[^+\d]/g, ''))}">${esc(s.phone)}</a><br><a href="mailto:${esc(s.email)}">${esc(s.email)}</a></p><p><a href="/privacy">Privacy &amp; Disclaimer</a></p></div></div>
<div class="wrap foot-note"><p>${esc(s.footer_note)}</p><p>${esc(s.copyright)}</p></div></footer><script src="/js/site.js"></script></body></html>`;
}
export const renderBlocks = (blocks, ctx) => (blocks || []).filter((b) => !b.hidden && R[b.type]).map((b) => R[b.type](b, ctx)).join('\n');
