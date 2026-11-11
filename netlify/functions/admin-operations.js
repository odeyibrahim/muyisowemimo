import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db, reply, clientIp, clip, isUuid, slugify } from './_lib/db.js';
import { BLOCKS, SETTINGS, PAGES, cleanPage, cleanSettings } from './_lib/schema.js';
import DEFAULTS from './_lib/defaults.js';

const MAX_FAILS = 5, WINDOW_MIN = 15, SESSION_HOURS = 24, KEEP_VERSIONS = 25;
const sha = (t) => crypto.createHash('sha256').update(t).digest('hex');
const validSlug = (s) => s === '_site' || PAGES.some((p) => p.slug === s);
const okUser = (u) => /^[a-z0-9._-]{3,40}$/.test(u);

export const handler = async (e) => {
  if (e.httpMethod === 'OPTIONS') return reply(204, '');
  if (e.httpMethod !== 'POST') return reply(405, { error: 'Method not allowed' });
  let body; try { body = JSON.parse(e.body || '{}'); } catch { return reply(400, { error: 'Invalid request body' }); }
  const { operation, data = {} } = body;
  try {
    const sb = db();
    // ---------- LOGIN: DB users (bcrypt) or the owner login from environment variables; IP lockout ----------
    if (operation === 'login') {
      const ip = clientIp(e);
      const since = new Date(Date.now() - WINDOW_MIN * 60000).toISOString();
      const { count } = await sb.from('login_attempts').select('id', { count: 'exact', head: true }).eq('ip', ip).eq('success', false).gt('created_at', since);
      if ((count || 0) >= MAX_FAILS) return reply(429, { error: `Too many failed attempts. Try again in ${WINDOW_MIN} minutes.` });
      const uname = clip(data.username, 40).toLowerCase(), pw = typeof data.password === 'string' ? data.password : '';
      let role = null;
      const { data: u } = await sb.from('admin_users').select('*').eq('username', uname).maybeSingle();
      if (u?.active && pw && bcrypt.compareSync(pw, u.password_hash)) role = u.role || 'editor';
      else if (process.env.ADMIN_PASSWORD_HASH && pw && uname === (process.env.ADMIN_USERNAME || 'admin').toLowerCase() && bcrypt.compareSync(pw, process.env.ADMIN_PASSWORD_HASH)) role = 'owner';
      else if (!process.env.ADMIN_PASSWORD_HASH && !u) return reply(500, { error: 'Admin login is not configured.' });
      await sb.from('login_attempts').insert({ ip, success: !!role });
      if (!role) return reply(401, { error: 'Credentials not recognised.' });
      const token = crypto.randomBytes(32).toString('hex');
      await sb.from('admin_sessions').delete().lt('expires_at', new Date().toISOString());
      await sb.from('login_attempts').delete().lt('created_at', new Date(Date.now() - 7 * 86400000).toISOString());
      const { error } = await sb.from('admin_sessions').insert({ token_hash: sha(token), username: uname, role, expires_at: new Date(Date.now() + SESSION_HOURS * 3600000).toISOString() });
      if (error) throw error;
      return reply(200, { success: true, token, username: uname, role });
    }
    const token = e.headers['x-admin-token'] || e.headers['X-Admin-Token'];
    if (!token) return reply(401, { error: 'Authentication required' });
    const { data: session } = await sb.from('admin_sessions').select('*').eq('token_hash', sha(token)).gt('expires_at', new Date().toISOString()).maybeSingle();
    if (!session) return reply(401, { error: 'Invalid or expired session' });
    const owner = session.role === 'owner';
    const needsId = ['update_enquiry', 'delete_enquiry', 'delete_post', 'delete_media', 'restore_version'];
    if (needsId.includes(operation) && !isUuid(data.id)) return reply(400, { error: 'Invalid id' });
    if (operation === 'save_post' && data.id && !isUuid(data.id)) return reply(400, { error: 'Invalid id' });
    const ok = (o = { success: true }) => reply(200, o);
    const saveVersion = async (slug, content) => {
      await sb.from('content_versions').insert({ slug, content, saved_by: session.username });
      const { data: all } = await sb.from('content_versions').select('id').eq('slug', slug).order('created_at', { ascending: false });
      const old = (all || []).slice(KEEP_VERSIONS).map((r) => r.id); if (old.length) await sb.from('content_versions').delete().in('id', old);
    };

    switch (operation) {
      case 'logout': await sb.from('admin_sessions').delete().eq('token_hash', sha(token)); return ok();
      case 'me': return ok({ username: session.username, role: session.role });
      case 'get_schema': return ok({ BLOCKS, SETTINGS, PAGES });

      // ---------- pages & site settings (versioned) ----------
      case 'get_site': {
        const { data: rows } = await sb.from('site_pages').select('slug,updated_at,updated_by');
        const by = Object.fromEntries((rows || []).map((r) => [r.slug, r]));
        return ok({ pages: PAGES.map((p) => ({ ...p, edited: !!by[p.slug], updated_at: by[p.slug]?.updated_at, updated_by: by[p.slug]?.updated_by })), settings_edited: !!by._site });
      }
      case 'get_page': {
        if (!validSlug(data.slug)) return reply(400, { error: 'Unknown page' });
        const { data: r } = await sb.from('site_pages').select('content').eq('slug', data.slug).maybeSingle();
        const def = data.slug === '_site' ? DEFAULTS.settings : DEFAULTS.pages[data.slug];
        return ok({ content: r?.content || def, edited: !!r });
      }
      case 'save_page': {
        if (!validSlug(data.slug)) return reply(400, { error: 'Unknown page' });
        const content = data.slug === '_site' ? cleanSettings(data.content) : cleanPage(data.content);
        const { error } = await sb.from('site_pages').upsert({ slug: data.slug, content, updated_at: new Date().toISOString(), updated_by: session.username }, { onConflict: 'slug' });
        if (error) throw error; await saveVersion(data.slug, content); return ok({ success: true, content });
      }
      case 'reset_page': {
        if (!validSlug(data.slug)) return reply(400, { error: 'Unknown page' });
        await sb.from('site_pages').delete().eq('slug', data.slug); return ok();
      }
      case 'get_versions': {
        if (!validSlug(data.slug)) return reply(400, { error: 'Unknown page' });
        const { data: v } = await sb.from('content_versions').select('id,created_at,saved_by').eq('slug', data.slug).order('created_at', { ascending: false }).limit(KEEP_VERSIONS);
        return ok(v || []);
      }
      case 'restore_version': {
        const { data: v } = await sb.from('content_versions').select('*').eq('id', data.id).maybeSingle();
        if (!v || !validSlug(v.slug)) return reply(404, { error: 'Version not found' });
        await sb.from('site_pages').upsert({ slug: v.slug, content: v.content, updated_at: new Date().toISOString(), updated_by: session.username }, { onConflict: 'slug' });
        await saveVersion(v.slug, v.content); return ok({ success: true, slug: v.slug });
      }

      // ---------- insights ----------
      case 'get_posts': { const { data: r, error } = await sb.from('posts').select('*').order('created_at', { ascending: false }); if (error) throw error; return ok(r); }
      case 'save_post': {
        if (!clip(data.title, 200)) return reply(400, { error: 'Title is required' });
        const pub = !!data.is_published;
        const row = { slug: slugify(data.slug || data.title) || `article-${Date.now().toString(36)}`, title: clip(data.title, 200), category: clip(data.category, 60) || 'Briefing', excerpt: clip(data.excerpt, 400), body: String(data.body || '').slice(0, 100000),
          cover_url: /^https:\/\//.test(data.cover_url || '') ? clip(data.cover_url, 500) : null, is_published: pub, updated_at: new Date().toISOString() };
        if (pub) row.published_at = data.published_at && !isNaN(Date.parse(data.published_at)) ? new Date(data.published_at).toISOString() : new Date().toISOString();
        const q = data.id ? sb.from('posts').update(row).eq('id', data.id) : sb.from('posts').insert(row);
        const { data: saved, error } = await q.select().single();
        if (error?.code === '23505') return reply(409, { error: 'That URL slug is already used by another article.' });
        if (error) throw error; return ok(saved);
      }
      case 'delete_post': { await sb.from('posts').delete().eq('id', data.id); return ok(); }

      // ---------- media library ----------
      case 'list_media': { const { data: r } = await sb.from('media').select('*').order('created_at', { ascending: false }).limit(300); return ok(r || []); }
      case 'upload_image': {
        const buf = Buffer.from(String(data.data || ''), 'base64');
        if (buf.length < 100 || buf.length > 3 * 1024 * 1024) return reply(400, { error: 'Image must be under 3 MB.' });
        const jpg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff, png = buf.subarray(0, 4).toString('hex') === '89504e47', webp = buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP';
        if (!jpg && !png && !webp) return reply(400, { error: 'Only JPEG, PNG or WebP images are allowed.' });
        const ext = jpg ? 'jpg' : png ? 'png' : 'webp';
        const path = `library/${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
        const { error } = await sb.storage.from('media').upload(path, buf, { contentType: `image/${jpg ? 'jpeg' : ext}`, cacheControl: '31536000' }); if (error) throw error;
        const url = sb.storage.from('media').getPublicUrl(path).data.publicUrl;
        const { data: m } = await sb.from('media').insert({ path, url, name: clip(data.name, 120) || path.split('/')[1], size: buf.length }).select().single();
        return ok({ url, media: m });
      }
      case 'delete_media': {
        const { data: m } = await sb.from('media').select('*').eq('id', data.id).maybeSingle();
        if (m) { await sb.storage.from('media').remove([m.path]); await sb.from('media').delete().eq('id', data.id); } return ok();
      }

      // ---------- enquiries ----------
      case 'get_enquiries': { const { data: r, error } = await sb.from('enquiries').select('id,type,name,email,phone,org,subject,message,status,created_at').order('created_at', { ascending: false }).limit(500); if (error) throw error; return ok(r); }
      case 'update_enquiry': { if (!['new', 'handled'].includes(data.status)) return reply(400, { error: 'Invalid status' }); await sb.from('enquiries').update({ status: data.status }).eq('id', data.id); return ok(); }
      case 'delete_enquiry': { await sb.from('enquiries').delete().eq('id', data.id); return ok(); }

      // ---------- users (owner only) ----------
      case 'list_users': { if (!owner) return reply(403, { error: 'Owner only' }); const { data: r } = await sb.from('admin_users').select('username,role,active,created_at'); return ok(r || []); }
      case 'save_user': {
        if (!owner) return reply(403, { error: 'Owner only' });
        const username = clip(data.username, 40).toLowerCase(); if (!okUser(username)) return reply(400, { error: 'Username: 3–40 letters, numbers, . _ -' });
        const { data: ex } = await sb.from('admin_users').select('username').eq('username', username).maybeSingle();
        const row = { username, role: 'editor', active: data.active !== false };
        if (data.password) { if (String(data.password).length < 10) return reply(400, { error: 'Password must be at least 10 characters.' }); row.password_hash = bcrypt.hashSync(String(data.password), 10); }
        else if (!ex) return reply(400, { error: 'A password is required for a new user.' });
        const { error } = await sb.from('admin_users').upsert(row, { onConflict: 'username' }); if (error) throw error;
        if (!row.active) await sb.from('admin_sessions').delete().eq('username', username);
        return ok();
      }
      case 'delete_user': { if (!owner) return reply(403, { error: 'Owner only' }); const u = clip(data.username, 40).toLowerCase(); await sb.from('admin_users').delete().eq('username', u); await sb.from('admin_sessions').delete().eq('username', u); return ok(); }
      default: return reply(400, { error: 'Invalid operation' });
    }
  } catch (err) { console.error('admin-operations error:', err); return reply(500, { error: 'Operation failed' }); }
};
