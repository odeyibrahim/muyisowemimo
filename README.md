# Muyi Sowemimo & Co. — Website + Site Manager

Ten-page corporate site with a full-site content manager ("Site Manager"). Static assets + Netlify Functions + Supabase.
Built by TUIX Solutions against quotation MS/WEB/RFQ/2026/001. For the reusable method behind this build, see `REBUILD-PLAYBOOK.md`.

## Try the Site Manager first (no setup)
Open **`demo/cms-demo.html`** (double-click). Login **`demo` / `demo1234`**. It is the real Site Manager and the real page renderer running on a mock database inside your browser: edit pages, reorder blocks, write articles, upload images, add users, then press *View page ↗* to see the saved result, and submit the contact form in the preview to see the enquiry arrive. Nothing touches a live site; changes stay in that browser ("Reset demo data" clears them). Rebuild it after any site change with `node demo/build-demo.mjs`.

## Go-live checklist
1. **Supabase** — create a project. SQL Editor → run `supabase/migrations/001_schema.sql`, then (optional) `002_sample_insights.sql`. Copy Project URL + **service_role** key (server-only).
2. **Owner password** — `npm install && npm run hash-password -- "a-strong-password"`; copy the `$2a$…` hash.
3. **GitHub → Netlify** — push, import the repo. `netlify.toml` sets publish dir, functions, redirects and security headers.
4. **Environment variables** (Netlify → Site configuration):
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SITE_URL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`
   `KEEPALIVE_KEY` (any long random string, see Keep-alive below)
   optional enquiry alerts: `RESEND_API_KEY`, `FROM_EMAIL`, `NOTIFY_EMAIL`.
5. Deploy → open `/admin` → sign in → Users → add editors.
6. Before launch: replace placeholder copy/portraits, set `SITE_URL`, point the domain, confirm both forms reach the firm.
7. Handover: transfer GitHub, Netlify, Supabase and domain accounts to the firm; give the manual and recorded training.

## Keep-alive (Supabase never pauses)
Supabase's free tier pauses a project after about 7 days without activity. Three independent layers prevent it; each performs a real database read **and** write (`keepalive` table):
1. **Netlify scheduled function** `keepalive.js`: runs at 05:00 and 17:00 UTC automatically after deploy. Nothing to configure.
2. **External pinger** → `https://YOUR-SITE/.netlify/functions/ping?key=KEEPALIVE_KEY`. Add it as a free monitor in UptimeRobot or cron-job.org (every 12–24 h). Wrong/missing key = refused.
3. **GitHub Actions** `.github/workflows/keepalive.yml`: pings the same URL every 2 days. Add repo secrets `SITE_URL` and `KEEPALIVE_KEY`.
Also: every public page view reads the database (60 s cache), and a weekly backup writes to the `backups` bucket. Public pages stay online even if the database pauses (bundled defaults are served); only the Site Manager would be affected. For a guaranteed always-on database, use Supabase Pro.

## Layout
```
public/                 index.html (static home snapshot) · css/site.css · js/site.js (reveals, menu, forms) · admin/ (Site Manager UI) · logo.svg · favicon.svg
netlify/functions/      site.js (renders every public page) · admin-operations.js (all admin actions)
                        submit-enquiry.js · keepalive.js (twice daily) · ping.js (external pinger) · backup.js (weekly) · notify.js
netlify/functions/_lib/ schema.js (blocks/settings/pages — single source of truth) · defaults.js (bundled copy)
                        render.js (blocks → HTML) · db.js (client, helpers, sanitising)
supabase/migrations/    001_schema.sql · 002_sample_insights.sql
demo/                   cms-demo.html (standalone try-it-first CMS) · build-demo.mjs · mock-api.js
tools/                  prerender-index.mjs (regenerates public/index.html)
.github/workflows/      keepalive.yml
```

## How it behaves
- Public pages are rendered by `site.js` from Supabase content (60 s edge cache). If the database is unreachable or paused, **bundled defaults are served**, so the site never goes blank.
- Saving in the Site Manager is live within about a minute. Every save is versioned (last 25 per page) and restorable; "Reset to default" returns a page to the delivered copy.
- Login: bcrypt, IP lockout after 5 failures / 15 min, 24 h sessions (token stored hashed). Roles: `owner` (env-var login, manages users) and `editor`.
- All tables are default-deny (RLS); only the functions (service-role key) can touch them. Admin page has a strict CSP; the admin UI never uses `innerHTML`.
- Images: resized in the browser (max 1600 px, JPEG), type-checked on the server by magic bytes, stored in the public `media` bucket.
- Weekly JSON backup of all content to the private `backups` bucket (keeps 12). Keep-alive: see above.

## Known wording gap vs the quotation
The quotation says pages are "static" and the site "rebuilds on Netlify" after Publish. This build instead renders on request with a 60-second cache (no rebuild step). Behaviour for the firm is the same or better (changes live in about a minute), but align the wording in Section E before sending.

`public/index.html` is a static snapshot of the home page. Because `netlify.toml` forces `/` through the site function, live visitors always get the Site Manager's current content; the snapshot is the recognised index file and a fallback. Regenerate with `node tools/prerender-index.mjs`.
