(function () {
  'use strict';
  var KEY = 'ms_admin_token', app = document.getElementById('app'), SCHEMA = null, ME = null, TOKEN = sessionStorage.getItem(KEY);

  // ---------- tiny DOM helper (no innerHTML anywhere: everything is text-safe) ----------
  function h(tag, attrs) {
    var el = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (k.indexOf('on') === 0) el.addEventListener(k.slice(2), v);
      else if (k === 'class') el.className = v;
      else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'hidden' || k === 'open') el[k] = v;
      else if (v !== false && v != null) el.setAttribute(k, v);
    });
    for (var i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  function add(el, c) { if (c == null || c === false) return; if (Array.isArray(c)) c.forEach(function (x) { add(el, x); }); else el.append(c.nodeType ? c : document.createTextNode(String(c))); }
  // fill(el, ...children): clear el, then append children. Accepts nodes, text, nulls and (nested) arrays.
  // Never call el.replaceChildren(array) directly: the DOM would stringify the array instead of appending its nodes.
  function fill(el) { el.replaceChildren(); for (var i = 1; i < arguments.length; i++) add(el, arguments[i]); return el; }
  function toast(msg, err) { var t = h('div', { class: 'toast' + (err ? ' err' : '') }, msg); document.getElementById('toasts').append(t); setTimeout(function () { t.remove(); }, 3800); }
  function human(k) { return k.replace(/_/g, ' ').replace(/^./, function (c) { return c.toUpperCase(); }); }
  function fdate(d) { return d ? new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'; }

  async function api(op, data) {
    var r = await fetch('/.netlify/functions/admin-operations', { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, TOKEN ? { 'X-Admin-Token': TOKEN } : {}), body: JSON.stringify({ operation: op, data: data || {} }) });
    var d = {}; try { d = await r.json(); } catch (e) { /* ignore */ }
    if (r.status === 401 && TOKEN) { sessionStorage.removeItem(KEY); TOKEN = null; renderLogin('Your session expired. Please sign in again.'); throw new Error('Session expired'); }
    if (!r.ok) throw new Error(d.error || 'Request failed');
    return d;
  }
  var guard = function (fn) { return function () { return Promise.resolve(fn.apply(null, arguments)).catch(function (e) { if (e.message !== 'Session expired') toast(e.message, true); }); }; };

  // ---------- login ----------
  function renderLogin(msg) {
    var err = h('p', { class: 'err' }, msg || ''), u = h('input', { type: 'text', autocomplete: 'username', placeholder: 'Username', required: 'required' }), p = h('input', { type: 'password', autocomplete: 'current-password', placeholder: 'Password', required: 'required' });
    var btn = h('button', { class: 'btn', type: 'submit' }, 'Sign in');
    var f = h('form', { onsubmit: async function (e) {
      e.preventDefault(); btn.disabled = true; err.textContent = '';
      try { var r = await api('login', { username: u.value, password: p.value }); TOKEN = r.token; ME = { username: r.username, role: r.role }; sessionStorage.setItem(KEY, TOKEN); boot(); }
      catch (x) { err.textContent = x.message === 'Failed to fetch' ? 'Network error. Please try again.' : x.message; p.value = ''; } btn.disabled = false;
    } }, h('img', { src: '/logo.svg', alt: '' }), h('h1', {}, 'Site Manager'), u, p, err, btn);
    fill(app, h('div', { class: 'login' }, f));
  }

  // ---------- shell ----------
  var NAV = [['pages', 'Pages'], ['posts', 'Insights'], ['media', 'Media library'], ['settings', 'Navigation, footer & contact'], ['enquiries', 'Enquiries'], ['users', 'Users']];
  var main;
  function shell(view) {
    var btns = NAV.filter(function (n) { return n[0] !== 'users' || ME.role === 'owner'; }).map(function (n) { return h('button', { class: view === n[0] ? 'on' : '', onclick: function () { go(n[0]); } }, n[1]); });
    main = h('div', { class: 'main' });
    fill(app, h('div', { class: 'shell' }, h('aside', { class: 'side' }, h('div', { class: 'brand' }, h('img', { src: '/logo.svg', alt: '' }), h('b', {}, 'SITE MANAGER')), btns,
      h('a', { href: '/', target: '_blank', rel: 'noopener', style: 'color:#e9dcd8;padding:10px 12px;text-decoration:none' }, 'View site ↗'), h('div', { class: 'sp' }), h('small', {}, ME.username + ' · ' + ME.role),
      h('button', { onclick: async function () { try { await api('logout'); } catch (e) { /* ignore */ } sessionStorage.removeItem(KEY); TOKEN = null; renderLogin(); } }, 'Sign out')), main));
  }
  var VIEWS = {};
  function go(v) { shell(v); VIEWS[v](); }

  // ---------- schema-driven field editor ----------
  function blank(t) {
    if (t === 'text' || t === 'long') return ''; if (t === 'bool') return false; if (t === 'num') return 0; if (Array.isArray(t)) return [];
    var o = {}; Object.keys(t).forEach(function (k) { o[k] = blank(t[k]); }); return o;
  }
  function fieldsFor(schema, obj) { return h('div', {}, Object.keys(schema).map(function (k) { return fieldEl(k, schema[k], obj); })); }
  function fieldEl(key, t, obj) {
    if (t === 'bool') return h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: !!obj[key], onchange: function (e) { obj[key] = e.target.checked; } }), human(key));
    if (t === 'text' || t === 'num') return h('div', { class: 'f' }, h('label', {}, human(key)), h('input', { type: t === 'num' ? 'number' : 'text', value: obj[key] == null ? '' : obj[key], oninput: function (e) { obj[key] = e.target.value; } }));
    if (t === 'long') return h('div', { class: 'f' }, h('label', {}, human(key)), h('textarea', { value: obj[key] || '', rows: 5, oninput: function (e) { obj[key] = e.target.value; } }));
    if (Array.isArray(t)) return repeater(key, t[0], obj);
    if (!obj[key] || typeof obj[key] !== 'object') obj[key] = blank(t);
    return h('fieldset', {}, h('legend', {}, human(key)), fieldsFor(t, obj[key]));
  }
  function repeater(key, itemSchema, obj) {
    var arr = obj[key] = Array.isArray(obj[key]) ? obj[key] : [], box = h('div', { class: 'rep' });
    function move(i, d) { var j = i + d; if (j < 0 || j >= arr.length) return; var x = arr[i]; arr[i] = arr[j]; arr[j] = x; draw(); }
    function draw() {
      fill(box, h('label', { class: 'lab' }, human(key) + ' (' + arr.length + ')'), arr.map(function (it, i) {
        return h('div', { class: 'item' }, fieldsFor(itemSchema, it), h('div', { class: 'ih' },
          h('button', { class: 'btn sec sm', type: 'button', onclick: function () { move(i, -1); } }, '↑'), h('button', { class: 'btn sec sm', type: 'button', onclick: function () { move(i, 1); } }, '↓'),
          h('button', { class: 'btn danger sm', type: 'button', onclick: function () { arr.splice(i, 1); draw(); } }, 'Remove')));
      }), h('button', { class: 'btn sec sm', type: 'button', onclick: function () { arr.push(blank(itemSchema)); draw(); } }, '+ Add'));
    }
    draw(); return box;
  }

  // ---------- pages ----------
  VIEWS.pages = guard(async function () {
    if (!SCHEMA) SCHEMA = await api('get_schema');
    var site = await api('get_site');
    main.append(h('h1', {}, 'Pages'), h('p', { class: 'sub' }, 'Edit every page: headings, text, biographies, practice areas, SEO. Changes go live within about a minute of saving.'),
      h('div', { class: 'list' }, site.pages.map(function (p) {
        return h('div', { class: 'it' }, h('div', {}, h('h4', {}, p.label), h('p', {}, p.path + (p.edited ? ' · edited ' + fdate(p.updated_at) + (p.updated_by ? ' by ' + p.updated_by : '') : ' · default content'))),
          h('button', { class: 'btn sm', onclick: function () { editPage(p.slug, p.label, p.path); } }, 'Edit'));
      })));
  });

  async function editPage(slug, label, path) {
    shell('pages');
    var r = await api('get_page', { slug: slug }), P = r.content; if (!Array.isArray(P.blocks)) P.blocks = [];
    var blocksBox = h('div', {}), prev = h('div', { class: 'gp' });
    function drawPrev() { fill(prev, h('div', { class: 't' }, P.seo_title || P.title || ''), h('div', { class: 'u' }, (location.origin) + path), h('div', { class: 'd' }, P.seo_description || '')); }
    function summary(b) { var f = SCHEMA.BLOCKS[b.type].f, k = Object.keys(f).find(function (x) { return f[x] === 'text' && b[x]; }); return k ? String(b[k]) : ''; }
    function drawBlocks() {
      fill(blocksBox, P.blocks.map(function (b, i) {
        var def = SCHEMA.BLOCKS[b.type]; if (!def) return null;
        var mv = function (d) { return function (e) { e.preventDefault(); var j = i + d; if (j < 0 || j >= P.blocks.length) return; var x = P.blocks[i]; P.blocks[i] = P.blocks[j]; P.blocks[j] = x; drawBlocks(); }; };
        return h('details', { class: 'blk' + (b.hidden ? ' hid' : '') }, h('summary', {}, h('div', { class: 'sum' }, h('b', {}, def.label + (b.hidden ? ' (hidden)' : '')), h('span', {}, summary(b))),
          h('button', { class: 'btn sec sm', type: 'button', onclick: mv(-1) }, '↑'), h('button', { class: 'btn sec sm', type: 'button', onclick: mv(1) }, '↓'),
          h('button', { class: 'btn sec sm', type: 'button', onclick: function (e) { e.preventDefault(); b.hidden = !b.hidden; drawBlocks(); } }, b.hidden ? 'Show' : 'Hide'),
          h('button', { class: 'btn danger sm', type: 'button', onclick: function (e) { e.preventDefault(); if (confirm('Delete this block?')) { P.blocks.splice(i, 1); drawBlocks(); } } }, 'Delete')),
          h('div', { class: 'body' }, fieldsFor(def.f, b)));
      }));
    }
    var sel = h('select', {}, Object.keys(SCHEMA.BLOCKS).map(function (k) { return h('option', { value: k }, SCHEMA.BLOCKS[k].label); }));
    var seoT = h('input', { type: 'text', value: P.seo_title || '', maxlength: 120, oninput: function (e) { P.seo_title = e.target.value; drawPrev(); } });
    var seoD = h('textarea', { rows: 2, maxlength: 320, value: P.seo_description || '', oninput: function (e) { P.seo_description = e.target.value; drawPrev(); } });
    var verBox = h('div', {});
    drawPrev(); drawBlocks();
    main.append(h('p', {}, h('a', { href: '#', onclick: function (e) { e.preventDefault(); go('pages'); } }, '← All pages')), h('h1', {}, label), h('p', { class: 'sub' }, path + (r.edited ? '' : ' · currently showing the default content')),
      h('div', { class: 'card' }, h('h4', {}, 'Search appearance (SEO)'), h('label', { class: 'lab' }, 'Page title'), seoT, h('label', { class: 'lab' }, 'Description'), seoD, prev,
        h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: !!P.hidden, onchange: function (e) { P.hidden = e.target.checked; } }), 'Hide this page from the public site')),
      h('h3', { style: 'margin:18px 0 8px' }, 'Content blocks'), blocksBox,
      h('div', { class: 'row' }, sel, h('button', { class: 'btn sec', type: 'button', onclick: function () { var t = sel.value; var b = Object.assign({ type: t, hidden: false }, blank(SCHEMA.BLOCKS[t].f)); P.blocks.push(b); drawBlocks(); } }, '+ Add block')),
      h('div', { class: 'savebar' }, h('button', { class: 'btn', onclick: guard(async function (e) { e.target.disabled = true; try { var s = await api('save_page', { slug: slug, content: P }); P = s.content; toast('Saved and published.'); } finally { e.target.disabled = false; } }) }, 'Save & publish'),
        h('a', { class: 'btn sec', href: path, target: '_blank', rel: 'noopener' }, 'View page ↗'),
        h('button', { class: 'btn sec', onclick: guard(async function () { var v = await api('get_versions', { slug: slug }); fill(verBox, h('div', { class: 'list' }, v.length ? v.map(function (x) { return h('div', { class: 'it' }, h('span', {}, fdate(x.created_at) + (x.saved_by ? ' · ' + x.saved_by : '')), h('button', { class: 'btn sm', onclick: guard(async function () { if (confirm('Restore this version? The current content is kept in history.')) { await api('restore_version', { id: x.id }); toast('Version restored.'); editPage(slug, label, path); } }) }, 'Restore')); }) : h('div', { class: 'it' }, 'No saved versions yet.'))); }) }, 'Version history'),
        h('button', { class: 'btn danger', onclick: guard(async function () { if (confirm('Discard all edits and return this page to its original content?')) { await api('reset_page', { slug: slug }); toast('Page reset to default.'); editPage(slug, label, path); } }) }, 'Reset to default')), verBox);
  }

  // ---------- site settings ----------
  VIEWS.settings = guard(async function () {
    if (!SCHEMA) SCHEMA = await api('get_schema');
    var r = await api('get_page', { slug: '_site' }), S = r.content;
    main.append(h('h1', {}, 'Navigation, footer & contact'), h('p', { class: 'sub' }, 'Firm name, phone and email, offices (addresses and map locations), the main menu and the footer.'), fieldsFor(SCHEMA.SETTINGS, S),
      h('div', { class: 'savebar' }, h('button', { class: 'btn', onclick: guard(async function (e) { e.target.disabled = true; try { await api('save_page', { slug: '_site', content: S }); toast('Saved and published.'); } finally { e.target.disabled = false; } }) }, 'Save & publish'),
        h('button', { class: 'btn danger', onclick: guard(async function () { if (confirm('Reset these settings to the original defaults?')) { await api('reset_page', { slug: '_site' }); toast('Reset.'); go('settings'); } }) }, 'Reset to default')));
  });

  // ---------- image helpers ----------
  function resizeToJpeg(file) {
    return createImageBitmap(file).then(function (img) {
      var k = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.85).split(',')[1];
    });
  }
  async function uploadFile(file) { var data = await resizeToJpeg(file); return api('upload_image', { data: data, name: file.name }); }

  // ---------- insights ----------
  VIEWS.posts = guard(async function () {
    var posts = await api('get_posts');
    main.append(h('div', { class: 'row sb' }, h('h1', {}, 'Insights'), h('button', { class: 'btn', onclick: function () { editPost(null); } }, '+ New article')), h('p', { class: 'sub' }, 'Write, save as draft, publish and unpublish briefings.'),
      h('div', { class: 'list' }, posts.length ? posts.map(function (p) {
        return h('div', { class: 'it' }, h('div', {}, h('h4', {}, p.title), h('p', {}, (p.is_published ? 'Published ' + fdate(p.published_at) : 'Draft') + ' · ' + (p.category || 'Briefing') + ' · /insights/' + p.slug)), h('button', { class: 'btn sm', onclick: function () { editPost(p); } }, 'Edit'));
      }) : h('div', { class: 'it' }, 'No articles yet.')));
  });
  function editPost(p) {
    shell('posts'); var P = p ? Object.assign({}, p) : { title: '', slug: '', category: 'Briefing', excerpt: '', body: '', cover_url: '', is_published: false };
    var cover = h('input', { type: 'text', value: P.cover_url || '', oninput: function (e) { P.cover_url = e.target.value; } });
    function f(label, key, tag, rows) { var el = h(tag || 'input', { type: tag ? null : 'text', value: P[key] || '', rows: rows, oninput: function (e) { P[key] = e.target.value; } }); return [h('label', { class: 'lab' }, label), el]; }
    add(main, [h('p', {}, h('a', { href: '#', onclick: function (e) { e.preventDefault(); go('posts'); } }, '← All articles')), h('h1', {}, p ? 'Edit article' : 'New article'),
      f('Title', 'title'), f('URL slug (optional — generated from the title)', 'slug'), f('Category', 'category'), f('Summary (cards and search results)', 'excerpt', 'textarea', 2), f('Body', 'body', 'textarea', 16),
      h('p', { class: 'sub', style: 'margin-top:6px' }, 'Blank line = new paragraph · “## ” starts a sub-heading · “- ” starts a bullet · **bold** · [text](https://link)'),
      h('label', { class: 'lab' }, 'Cover image address (https)'), cover, h('label', { class: 'lab' }, '…or upload an image'),
      h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', onchange: guard(async function (e) { var fl = e.target.files[0]; if (!fl) return; var r = await uploadFile(fl); cover.value = r.url; P.cover_url = r.url; toast('Image uploaded.'); e.target.value = ''; }) }),
      h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: !!P.is_published, onchange: function (e) { P.is_published = e.target.checked; } }), 'Published on the public site'),
      h('div', { class: 'savebar' }, h('button', { class: 'btn', onclick: guard(async function () { await api('save_post', P); toast(P.is_published ? 'Saved and published.' : 'Saved as draft.'); go('posts'); }) }, 'Save article'),
        p ? h('button', { class: 'btn danger', onclick: guard(async function () { if (confirm('Delete this article permanently?')) { await api('delete_post', { id: p.id }); toast('Deleted.'); go('posts'); } }) }, 'Delete') : null)]);
  }

  // ---------- media ----------
  VIEWS.media = guard(async function () {
    var list = await api('list_media'), grid = h('div', { class: 'media' });
    list.forEach(function (m) {
      grid.append(h('div', { class: 'm' }, h('img', { src: m.url, alt: '', loading: 'lazy' }), h('div', { class: 'mb' },
        h('button', { class: 'btn sec sm', onclick: function () { navigator.clipboard.writeText(m.url).then(function () { toast('Link copied.'); }); } }, 'Copy link'),
        h('button', { class: 'btn danger sm', onclick: guard(async function () { if (confirm('Delete this image? Pages using it will show a gap.')) { await api('delete_media', { id: m.id }); go('media'); } }) }, 'Delete'))));
    });
    main.append(h('h1', {}, 'Media library'), h('p', { class: 'sub' }, 'Upload images, then paste their link into a page, an article or a profile.'),
      h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', multiple: 'multiple', onchange: guard(async function (e) { for (var i = 0; i < e.target.files.length; i++) await uploadFile(e.target.files[i]); toast('Uploaded.'); go('media'); }) }), h('div', { style: 'height:16px' }), list.length ? grid : h('p', { class: 'sub' }, 'No images yet.'));
  });

  // ---------- enquiries ----------
  VIEWS.enquiries = guard(async function () {
    var rows = await api('get_enquiries');
    main.append(h('h1', {}, 'Enquiries'), h('p', { class: 'sub' }, 'General enquiries and international referrals received through the website.'),
      rows.length ? h('table', {}, h('thead', {}, h('tr', {}, ['Received', 'From', 'Message', ''].map(function (x) { return h('th', {}, x); }))), h('tbody', {}, rows.map(function (r) {
        return h('tr', {}, h('td', {}, fdate(r.created_at), h('br'), h('span', { class: 'badge' + (r.status === 'new' ? ' new' : ' ok') }, r.status), ' ', h('span', { class: 'badge' }, r.type)),
          h('td', {}, h('b', {}, r.name), h('br'), r.org || '', r.org ? h('br') : null, h('a', { href: 'mailto:' + r.email }, r.email), h('br'), r.phone || ''),
          h('td', { style: 'white-space:pre-wrap;max-width:360px' }, (r.subject ? '[' + r.subject + '] ' : '') + r.message),
          h('td', {}, h('button', { class: 'btn sec sm', onclick: guard(async function () { await api('update_enquiry', { id: r.id, status: r.status === 'new' ? 'handled' : 'new' }); go('enquiries'); }) }, r.status === 'new' ? 'Mark handled' : 'Reopen'), ' ',
            h('button', { class: 'btn danger sm', onclick: guard(async function () { if (confirm('Delete this enquiry?')) { await api('delete_enquiry', { id: r.id }); go('enquiries'); } }) }, 'Delete')));
      }))) : h('p', { class: 'sub' }, 'No enquiries yet.'));
  });

  // ---------- users (owner) ----------
  VIEWS.users = guard(async function () {
    if (ME.role !== 'owner') { main.append(h('p', {}, 'Only the owner can manage users.')); return; }
    var users = await api('list_users'), un = h('input', { type: 'text', placeholder: 'username', autocomplete: 'off' }), pw = h('input', { type: 'password', placeholder: 'password (min. 10 characters)', autocomplete: 'new-password' });
    main.append(h('h1', {}, 'Users'), h('p', { class: 'sub' }, 'Editors can change content but cannot manage users. The owner login is set in the Netlify environment variables.'),
      h('div', { class: 'card' }, h('h4', {}, 'Add or update an editor'), h('div', { class: 'row' }, h('div', { class: 'grow' }, un), h('div', { class: 'grow' }, pw), h('button', { class: 'btn', onclick: guard(async function () { await api('save_user', { username: un.value, password: pw.value }); toast('Saved.'); go('users'); }) }, 'Save')), h('p', { class: 'sub', style: 'margin:8px 0 0' }, 'To reset a password, save the same username with a new password.')),
      h('div', { class: 'list' }, users.length ? users.map(function (u) {
        return h('div', { class: 'it' }, h('div', {}, h('h4', {}, u.username), h('p', {}, u.role + ' · ' + (u.active ? 'active' : 'disabled'))), h('div', { class: 'row' },
          h('button', { class: 'btn sec sm', onclick: guard(async function () { await api('save_user', { username: u.username, active: !u.active }); go('users'); }) }, u.active ? 'Disable' : 'Enable'),
          h('button', { class: 'btn danger sm', onclick: guard(async function () { if (confirm('Delete ' + u.username + '?')) { await api('delete_user', { username: u.username }); go('users'); } }) }, 'Delete')));
      }) : h('div', { class: 'it' }, 'No editors yet.')));
  });

  // ---------- boot ----------
  async function boot() {
    if (!TOKEN) return renderLogin();
    try { ME = await api('me'); } catch (e) { return; }
    go('pages');
  }
  boot();
})();
