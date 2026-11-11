import { clip, safeHref } from './db.js';
// Single source of truth: the public renderer, the server-side validator and the admin editor all use this.
export const LINK = { label: 'text', href: 'text' };
export const BLOCKS = {
  hero: { label: 'Hero', f: { kicker: 'text', headline: 'text', accent: 'text', text: 'long', note: 'text', buttons: [LINK] } },
  strip: { label: 'Highlights strip', f: { heading: 'text', items: [{ title: 'text' }] } },
  text: { label: 'Text section', f: { kicker: 'text', heading: 'text', body: 'long' } },
  cards: { label: 'Cards grid', f: { kicker: 'text', heading: 'text', intro: 'long', items: [{ title: 'text', body: 'long' }] } },
  people: { label: 'People', f: { kicker: 'text', heading: 'text', intro: 'long', items: [{ name: 'text', role: 'text', areas: 'text', bio: 'long' }] } },
  offices: { label: 'Offices & maps (from Site settings)', f: { kicker: 'text', heading: 'text', intro: 'long' } },
  insights: { label: 'Latest insights (automatic)', f: { kicker: 'text', heading: 'text', intro: 'long', limit: 'num' } },
  band: { label: 'Call-to-action band', f: { heading: 'text', text: 'long', buttons: [LINK] } },
  contact: { label: 'Contact & forms', f: { heading: 'text', intro: 'long', referral_heading: 'text', referral_intro: 'long' } }
};
export const SETTINGS = {
  firm: 'text', tagline: 'text', phone: 'text', email: 'text', web: 'text', hours: 'text',
  nav: [{ label: 'text', href: 'text', hidden: 'bool' }], cta: LINK,
  offices: [{ name: 'text', tag: 'text', address: 'long', note: 'long', map: 'text' }],
  footer_note: 'long', disclaimer: 'long', copyright: 'text'
};
export const PAGES = [
  { slug: 'home', path: '/', label: 'Home' }, { slug: 'legacy', path: '/legacy', label: 'Legacy & Values' },
  { slug: 'practice-areas', path: '/practice-areas', label: 'Practice Areas' }, { slug: 'referral-desk', path: '/referral-desk', label: 'International Referral Desk' },
  { slug: 'insights', path: '/insights', label: 'Insights' }, { slug: 'principal', path: '/principal', label: 'The Principal' },
  { slug: 'of-counsel', path: '/of-counsel', label: 'Of Counsel' }, { slug: 'offices', path: '/offices', label: 'Offices' },
  { slug: 'contact', path: '/contact', label: 'Contact' }, { slug: 'privacy', path: '/privacy', label: 'Privacy & Disclaimer' }
];
export function clean(v, t) {
  if (t === 'text') return clip(v, 400);
  if (t === 'long') return String(v ?? '').slice(0, 20000);
  if (t === 'bool') return !!v;
  if (t === 'num') return Math.max(0, Math.min(50, parseInt(v, 10) || 0));
  if (Array.isArray(t)) return (Array.isArray(v) ? v : []).slice(0, 60).map((x) => clean(x, t[0]));
  const o = {}; for (const k of Object.keys(t)) o[k] = clean(v?.[k], t[k]);
  if ('href' in t) o.href = safeHref(o.href);
  if ('map' in t) o.map = clip(o.map, 200);
  return o;
}
export const cleanSettings = (s) => clean(s || {}, SETTINGS);
export function cleanPage(p = {}) {
  const blocks = (Array.isArray(p.blocks) ? p.blocks : []).slice(0, 40).filter((b) => BLOCKS[b?.type])
    .map((b) => ({ type: b.type, hidden: !!b.hidden, ...clean(b, BLOCKS[b.type].f) }));
  return { title: clip(p.title, 120), seo_title: clip(p.seo_title, 120), seo_description: clip(p.seo_description, 320), hidden: !!p.hidden, blocks };
}
