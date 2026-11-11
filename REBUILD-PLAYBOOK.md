# Rebuild Playbook — "Editorial professional-services site + full-site CMS"

A reusable method for building a serious-looking, fixed-price professional-services website (law firm, advisory, VC, consultancy, clinic) that the client can edit end-to-end without a developer. Distilled from the Muyi Sowemimo & Co. build (TUIX Solutions, quotation MS/WEB/RFQ/2026/001), whose look is derived from the Dallas VC reference page and whose admin logic comes from the Rarified One "Private Desk" project.

Use this file as the brief when asking Claude to rebuild or adapt the system: "Follow REBUILD-PLAYBOOK.md; client = X; industry = Y; palette = Z."

---

## 1. The product in one paragraph
A hand-coded site where **every word a visitor reads lives in a database** and is edited through a private Site Manager. No page builder, no WordPress, no plugins. Pages are made of a **fixed vocabulary of blocks** (hero, text, cards, people, offices, insights, band, contact). The client can edit, reorder, hide and add blocks, write blog posts, manage images, navigation, offices and SEO, and restore earlier versions. They cannot redesign layout; that is a quoted change. That boundary is the commercial model: design integrity is protected, support is predictable, the annual price can be fixed.

## 2. Design language (the "DVC look")
**Character:** editorial, calm, institutional. Warm paper background, one strong brand colour, hairline rules, big serif headlines, generous white space, nothing decorative that is not structural.

| Token | Value (Muyi build) | Role |
|---|---|---|
| `--cream` | `#FBF8F3` | page background |
| `--cream2` / `--tint` | `#F1E8DC` / `#F5EFE6` | alternate sections, tiles |
| `--ink` / `--soft` | `#2d2a2a` / `#5b5656` | text / secondary text |
| `--red` | `#7a1020` | brand accent: kickers, buttons, italic headline accent |
| `--red-mid` / `--red-deep` | `#6c0c1b` / `#4a0a14` | gradients, footer, band |
| `--line` / `--line2` | `#D9D2C5` / `#B9B2A4` | hairlines |
| Serif / Sans | Instrument Serif / Manrope | headlines (regular + *italic accent*) / body, UI |
| Max width | 1400 px, 32 px gutters (20 px on phones) | |

(The DVC original uses the same cream/ink system with navy `#0B295D` / blue `#164B98` as the brand colour; swapping brand colour is a token change, not a redesign.)

**Signature moves to keep**
- Header: sticky, cream, 1 px ink bottom rule, logo left, centred nav with small chevron separators, text-link CTA with a leading rule on the right.
- Hero: kicker in spaced caps → huge serif headline where the **second half is italic in the brand colour** → lead paragraph beside a faint dot-grid → primary (filled) + ghost buttons → a brand tile (logo on deep-colour gradient) on the far right.
- Numbered highlights strip (`01 02 03 04`) with hairline cell borders directly under the hero.
- Sections alternate cream / tint; cards have a small number, serif title, sans body.
- Buttons: solid brand colour, 14 px, trailing `›`; ghost = 1 px brand border.
- Motion: scroll reveals only (`.rv` → `.in` via IntersectionObserver), disabled for `prefers-reduced-motion`; content stays visible if JS fails (`.js` class gate).
- No stock imagery. People are shown as monogram tiles until portraits arrive, so launch is never blocked.

**Logo / brand red.** Supplied logo is rebuilt as a vector (`logo.svg`, `favicon.svg`): serif "MS" monogram in warm white on a deep-red field with a radial **vignette that darkens the corners**. Printed red looked washed out, so the screen red is deliberately deeper (`#8e1426` centre → `#3d0610` corners, vignette to `#14020a`) and the glyphs are **vector outlines, not an embedded raster**, so they stay sharp at any size and in print. Reuse the gradient on the hero tile, favicon, admin sidebar and footer band so the red reads as one material.

## 3. Industry layer (what changes per vertical)
Keep the engine; change only content model, tone and trust signals.

**Law firm (this build)** — pages: Home, Legacy & Values, Practice Areas, International Referral Desk, Insights, The Principal, Of Counsel, Offices, Contact, Privacy & Disclaimer.
- Trust signals: lineage/provenance stated carefully (and disclaimed as *not* a current affiliation), called-to-bar year, qualifications, named Of Counsel, two real offices with Google Maps embeds.
- Compliance: Privacy & Disclaimer page in the footer; enquiry handling aligned to the Nigeria Data Protection Act 2023; no outcome promises; no client names without consent.
- Conversion paths: general enquiry **and** a separate referral form (foreign counsel are a distinct audience).
- Insights = regulatory briefings (mining/energy, cross-border, constitutional, entertainment, wealth). Authority content, not marketing.
- Tone: plain, direct, "no gatekeeping, no opacity".

**To adapt:** list the 6–10 pages the client's circular/brief asks for → map each to existing blocks → add a new block only if an existing one cannot carry the content (see §6). VC → add a `portfolio` block; clinic → `services` + `booking` block; consultancy → `case-study` block.

## 4. Architecture (the engine)
```
Browser ──► Netlify (CDN + redirects + headers)
              ├─ /public            css, js, logo, admin UI (static)
              └─ /netlify/functions
                   site.js              renders any public page (slug → HTML), sitemap, single posts
                   admin-operations.js  every admin action (POST {operation, data} + X-Admin-Token)
                   submit-enquiry.js    public forms (honeypot, rate limit, optional email alert)
                   keepalive.js (twice daily) · ping.js (HTTP, key-protected) · backup.js (weekly)
            Supabase: Postgres (RLS default-deny) + Storage (public `media`, private `backups`)
```
- **Rendering:** `site.js` loads `site_pages` + `_site` settings + published `posts`, merges with bundled `defaults.js` if a page has not been edited, and returns server-rendered HTML (60 s cache). Fully crawlable, no client-side framework. **Fail-safe:** if Supabase is down/paused/slow (3 s timeout), bundled defaults are served.
- **Single source of truth:** `_lib/schema.js` defines `BLOCKS`, `SETTINGS`, `PAGES`. The same schema drives (a) the admin form generator, (b) server-side validation/sanitising (`clean`), (c) the renderer. Add a field once; all three follow.
- **Why not WordPress:** faster, nothing to patch, no public login page to attack, cheap to run → fixed annual price.
- **Why not static rebuilds:** no build hooks to manage; changes are live in about a minute. (Quotation wording must say this; see Pitfalls.)

## 5. Data model (Supabase)
`site_pages(slug pk, content jsonb, updated_at, updated_by)` · `content_versions(id, slug, content, saved_by, created_at)` (keep last 25/page) · `posts(id, slug unique, title, category, excerpt, body, cover_url, is_published, published_at…)` · `media(id, path, url, name, size)` · `enquiries(id, type general|referral, name, email, phone, org, subject, message, status new|handled, ip)` · `admin_users(username pk, password_hash, role, active)` · `admin_sessions(token_hash pk, username, role, expires_at)` · `login_attempts(ip, success, created_at)`.
All RLS-enabled with **no policies**: only the service-role key inside functions can read/write. Buckets: `media` (public), `backups` (private).

## 6. The admin logic (reusable core)
**Operations:** `login · logout · me · get_schema · get_site · get_page · save_page · reset_page · get_versions · restore_version · get_posts · save_post · delete_post · list_media · upload_image · delete_media · get_enquiries · update_enquiry · delete_enquiry · list_users · save_user · delete_user`.

**Security rules (non-negotiable, carried from Rarified One)**
1. Login fails closed if no hash is configured. bcrypt compare. IP lockout: 5 failures / 15 min → 429.
2. Session token = 32 random bytes; only its SHA-256 is stored; 24 h expiry; expired rows purged on login.
3. Owner = env-var credentials; editors = `admin_users` rows (min. 10-char password); only owner manages users.
4. Validate UUIDs; clip every string; whitelist enums (`status`, block types); `safeHref` for every link (blocks `javascript:`); cover images must be `https://`.
5. Image upload: client resizes (max 1600 px JPEG) → server checks magic bytes (JPEG/PNG/WebP) and size (<3 MB) → random filename.
6. Admin UI: no `innerHTML`, strict CSP (`script-src 'self'`), `noindex`, `X-Frame-Options: DENY`.
7. Public forms: honeypot field, per-IP rate limit, server-side validation, optional email alert that never blocks the save.

**Admin UI pattern:** one small DOM helper `h(tag, attrs, ...children)`; schema-driven field editor (`text | long | bool | num | [repeater] | {fieldset}`); block list as collapsible `<details>` with ↑ ↓ Hide Delete; Google-style SEO preview; Save & publish; Version history → Restore; Reset to default.

**To add a block type:** (1) add it to `BLOCKS` in `schema.js`; (2) add a renderer `R.<type>` in `render.js`; (3) add CSS; (4) use it in `defaults.js`. Admin form + validation appear automatically.

## 7. Build recipe for a new client (order of work)
1. **Intake:** circular/brief, section list, evaluation criteria, copy deck, logo, 2–3 reference sites. Note which parts are fixed by the client (e.g. "design first criterion", "price that does not move").
2. **Quotation first** (design shown before price): at-a-glance table, drawn mockups, Site Manager screens, itemised pricing (Build / Care plan / 3-year view), timeline, references (be honest where none are comparable), support SLA, technical & handover, terms, draft agreement.
3. **Tokens + logo:** set palette, rebuild logo as vector, favicon.
4. **Schema + defaults:** transcribe the client's copy into `defaults.js` page by page (this *is* the content).
5. **Render + CSS:** reuse the DVC-style components; adjust tokens only.
6. **Admin:** copy unchanged; change names, `ADMIN_USERNAME`, SEO labels.
7. **Forms + email alerts, maps, sitemap, robots.**
8. **Test (see §8), then staging link to the client.**
9. **Launch:** content load via the Site Manager itself (proves the CMS), training recording, manual, account transfer.

## 8. Testing without a live database
`/tmp/mp` harness pattern: copy the project; stub `@supabase/supabase-js` with an in-memory implementation (tables as arrays, a tiny query builder supporting select/insert/update/upsert/delete/eq/gt/lt/in/order/limit/single/maybeSingle/head-count, storage upload/list/remove/getPublicUrl); stub `bcryptjs` with `HASH:<password>`; a 40-line Node server maps Netlify redirects to the handlers. Then Playwright drives: every public page → 200; bad/good login; edit → save → **public HTML contains the edit**; reorder/add/delete block; version history; reset; create + publish post → appears on /insights; each admin tab renders; enquiry form submits; 390 px viewport has no horizontal scroll; no page errors. The Muyi build passes **35/35**.

## 9. Pitfalls (learned the hard way)
- **Never pass an array to `el.replaceChildren()` or `el.append()`.** The DOM stringifies it into `[object HTMLLabelElement]` and blocks/forms render blank. Use the `fill(el, ...children)` / `add(el, children)` helper that flattens arrays. This bit twice (block list, article form).
- Quotation vs reality: the quotation originally promised static pages + "site rebuilds on Netlify". The engine is server-rendered with a 60 s cache. Change the quotation wording (or build a rebuild-hook variant) before sending.
- Supabase free tier pauses after ~a week idle. Use three layers, each doing a real read+write: Netlify scheduled function, key-protected `ping` endpoint for UptimeRobot/cron-job.org, and a GitHub Actions cron. Weekly backup; offer Pro ($25/mo at cost) for always-on.
- Ship a **standalone demo** (`demo/cms-demo.html`, built by `demo/build-demo.mjs`): same admin UI + renderer + schema bundled with an in-browser mock API (localStorage), test login `demo` / `demo1234`. Lets the client try the CMS before any hosting exists. Rebuild it whenever schema or UI changes.
- Printed brand red is duller than screen red; define the screen red deeper and ship the logo as vector.
- Don't invent references or portfolio. State "not yet built a site for a law firm" if true and offer a staging demo instead.
- Don't let a lineage claim read as a current affiliation; keep the disclaimer next to it.
- Keep placeholder portraits (monogram tiles) so missing photos never delay launch.

## 10. Commercial frame (from the quotation)
₦460,000 build (Design 130k · Build + Site Manager 270k · Launch & handover 60k) + ₦140,000 first-year care plan = **₦600,000 all-inclusive**; renewal ₦140,000/yr, price-locked years 2–3 (three-year total ₦880,000). 4-week plan (kick-off → design approval gate → build → content/QA/launch); 50/30/20 payments; 60-day warranty; up to 3 small edits/month; extra work ₦10,000/hr or fixed; IP transfers on full payment; code in the client's GitHub, content in the client's Supabase, manual + recorded training for takeover by any developer.

## 11. Files that define the system (copy these first)
`netlify/functions/_lib/schema.js` · `_lib/render.js` · `_lib/defaults.js` · `_lib/db.js` · `site.js` · `admin-operations.js` · `submit-enquiry.js` · `keepalive.js` · `backup.js` · `public/css/site.css` · `public/js/site.js` · `public/admin/{index.html,admin.js,admin.css}` · `supabase/migrations/001_schema.sql` · `netlify.toml` · `demo/*` · `.github/workflows/keepalive.yml`.
