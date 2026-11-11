(function () {
  'use strict';
  var burger = document.getElementById('burger'), nav = document.getElementById('nav');
  if (burger && nav) burger.addEventListener('click', function () {
    var open = document.body.classList.toggle('menu-open'); burger.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  // scroll reveals (content stays visible if JS or IntersectionObserver is unavailable)
  var els = document.querySelectorAll('.rv');
  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { threshold: 0.08 });
    els.forEach(function (el) { io.observe(el); });
    setTimeout(function () { els.forEach(function (el) { el.classList.add('in'); }); }, 2500);
  } else els.forEach(function (el) { el.classList.add('in'); });
  // enquiry + referral forms
  document.querySelectorAll('form[data-form]').forEach(function (f) {
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var msg = f.querySelector('.form-msg'), btn = f.querySelector('button[type=submit]');
      var body = { type: f.dataset.form }; new FormData(f).forEach(function (v, k) { body[k] = v; });
      if (!f.checkValidity()) { msg.textContent = 'Please complete the required fields.'; msg.className = 'form-msg err'; f.reportValidity && f.reportValidity(); return; }
      btn.disabled = true; msg.className = 'form-msg'; msg.textContent = 'Sending…';
      fetch('/.netlify/functions/submit-enquiry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || 'Could not send.'); return d; }); })
        .then(function () { f.reset(); msg.textContent = 'Thank you — your message has been received. We will respond personally.'; msg.className = 'form-msg ok'; })
        .catch(function (err) { msg.textContent = err.message === 'Failed to fetch' ? 'Network error. Please try again or call the firm.' : err.message; msg.className = 'form-msg err'; })
        .then(function () { btn.disabled = false; });
    });
  });
})();
