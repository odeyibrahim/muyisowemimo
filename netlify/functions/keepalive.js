import { pulse } from './_lib/pulse.js';
// Layer 1 — Netlify scheduled function, twice a day. Supabase's free tier pauses a project after about 7 days
// without activity; this makes sure it never gets near that. (Scheduled functions run on the published deploy.)
export const config = { schedule: '0 5,17 * * *' };
export default async () => {
  try { console.log('keepalive ok', await pulse()); } catch (e) { console.error('keepalive failed', e); }
  return new Response('ok');
};
