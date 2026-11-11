import { db, reply, clientIp, clip } from './_lib/db.js';
import { sendNotice } from './_lib/notify.js';
export const handler = async (e) => {
  if (e.httpMethod === 'OPTIONS') return reply(204, '');
  if (e.httpMethod !== 'POST') return reply(405, { error: 'Method not allowed' });
  try {
    const b = JSON.parse(e.body || '{}');
    if (b.website) return reply(200, { success: true }); // honeypot: pretend success to bots
    const row = { type: b.type === 'referral' ? 'referral' : 'general', name: clip(b.name, 120), email: clip(b.email, 160), phone: clip(b.phone, 40), org: clip(b.org, 160), subject: clip(b.subject, 160), message: clip(b.message, 4000), ip: clientIp(e) };
    if (!row.name || !row.message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email) || (row.type === 'referral' && !row.org)) return reply(400, { error: 'Please complete the required fields with a valid email address.' });
    const sb = db();
    const { count } = await sb.from('enquiries').select('id', { count: 'exact', head: true }).eq('ip', row.ip).gt('created_at', new Date(Date.now() - 10 * 60000).toISOString());
    if ((count || 0) >= 5) return reply(429, { error: 'Too many submissions. Please try again shortly.' });
    const { error } = await sb.from('enquiries').insert(row); if (error) throw error;
    await sendNotice(row);
    return reply(200, { success: true });
  } catch (err) { console.error(err); return reply(500, { error: 'Could not send. Please call or email the firm directly.' }); }
};
