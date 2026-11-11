import { db } from './_lib/db.js';
// Weekly. Writes all site content (pages, settings, insights, media index, enquiries) as one JSON file to the private "backups" bucket in the firm's own Supabase account; keeps the latest 12.
export const config = { schedule: '@weekly' };
export default async () => {
  try {
    const sb = db(); const dump = { taken_at: new Date().toISOString() };
    for (const t of ['site_pages', 'posts', 'media', 'enquiries', 'admin_users']) {
      const { data, error } = await sb.from(t).select('*'); if (error) throw error;
      dump[t] = t === 'admin_users' ? (data || []).map(({ password_hash, ...u }) => u) : data;
    }
    const name = `backup-${dump.taken_at.slice(0, 10)}.json`;
    const { error } = await sb.storage.from('backups').upload(name, Buffer.from(JSON.stringify(dump)), { contentType: 'application/json', upsert: true }); if (error) throw error;
    const { data: files } = await sb.storage.from('backups').list('', { sortBy: { column: 'name', order: 'desc' } });
    const old = (files || []).map((f) => f.name).filter((n) => n.startsWith('backup-')).slice(12);
    if (old.length) await sb.storage.from('backups').remove(old);
    console.log('backup ok', name);
  } catch (e) { console.error('backup failed', e); }
  return new Response('ok');
};
