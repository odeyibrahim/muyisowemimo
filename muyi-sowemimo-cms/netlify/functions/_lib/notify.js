const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Optional email alert (Resend). Fails soft: a missing key never blocks an enquiry.
export async function sendNotice(r) {
  const { RESEND_API_KEY: k, FROM_EMAIL: from, NOTIFY_EMAIL: to } = process.env;
  if (!k || !from || !to) return;
  try {
    await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${k}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, reply_to: r.email, subject: `${r.type === 'referral' ? 'Referral' : 'Enquiry'} — ${r.name}`,
        html: `<p><b>${esc(r.name)}</b> (${esc(r.email)}, ${esc(r.phone)})<br>${esc(r.org)} ${esc(r.subject)}</p><p>${esc(r.message).replace(/\n/g, '<br>')}</p>` }) });
  } catch (e) { console.error('notify failed', e); }
}
