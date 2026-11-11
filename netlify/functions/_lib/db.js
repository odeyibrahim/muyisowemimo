import { createClient } from '@supabase/supabase-js';
export const db = () => createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
export const headers = (extra = {}) => ({ 'Access-Control-Allow-Origin': process.env.SITE_URL || '*', 'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token', 'Content-Type': 'application/json', ...extra });
export const reply = (code, obj, extra) => ({ statusCode: code, headers: headers(extra), body: code === 204 ? '' : JSON.stringify(obj) });
export const clientIp = (e) => ((e.headers['x-nf-client-connection-ip'] || e.headers['x-forwarded-for'] || 'unknown') + '').split(',')[0].trim();
export const clip = (v, n) => String(v ?? '').trim().slice(0, n);
export const isUuid = (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v || ''));
// Only relative paths, anchors, https, mailto and tel links are ever allowed.
export const safeHref = (h) => { const v = String(h ?? '').trim().slice(0, 500); return /^(\/(?!\/)|#|https:\/\/|mailto:|tel:)/i.test(v) ? v : ''; };
export const slugify = (s) => clip(s, 90).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
