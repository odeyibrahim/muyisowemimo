import { pulse } from './_lib/pulse.js';
// Layers 2 & 3 — an HTTP endpoint for external pingers (UptimeRobot, cron-job.org, GitHub Actions).
//   GET /.netlify/functions/ping?key=<KEEPALIVE_KEY>
// Without the right key it does nothing. Set KEEPALIVE_KEY in Netlify's environment variables.
export const handler = async (e) => {
  const key = process.env.KEEPALIVE_KEY, given = (e.queryStringParameters || {}).key || e.headers['x-keepalive-key'];
  if (!key || given !== key) return { statusCode: 401, body: 'unauthorised' };
  try { const r = await pulse(); return { statusCode: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(r) }; }
  catch (err) { console.error('ping failed', err); return { statusCode: 500, body: 'database unreachable' }; }
};
