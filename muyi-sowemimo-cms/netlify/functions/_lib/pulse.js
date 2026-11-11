import { db } from './db.js';
// One "pulse" = a real read AND a real write against the database, so Supabase always sees activity.
// Used by the scheduled keepalive (Netlify) and by the HTTP ping (external monitors / GitHub Actions).
export async function pulse() {
  const sb = db(); const at = new Date().toISOString();
  const read = await sb.from('site_pages').select('slug', { head: true, count: 'exact' });
  if (read.error) throw read.error;
  const write = await sb.from('keepalive').upsert({ id: 1, last_ping: at }, { onConflict: 'id' });
  if (write.error) throw write.error;
  return { ok: true, at };
}
