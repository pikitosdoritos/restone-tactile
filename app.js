/* ReStone Tactile — доступність, меню і форма. Без залежностей. */
(function () {
  'use strict';

  var root = document.documentElement;

  function store(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* приватний режим — просто не запам'ятовуємо */ }
  }

  /* ---------- A+ (збільшення шрифту) ---------- */
  var scaleLabels = ['Збільшити шрифт', 'Збільшити шрифт ще більше', 'Повернути звичайний шрифт'];
  function syncScale() {
    var s = parseInt(root.getAttribute('data-scale') || '0', 10);
    document.querySelectorAll('[data-action="scale"]').forEach(function (b) {
      b.setAttribute('aria-pressed', s > 0 ? 'true' : 'false');
      b.setAttribute('aria-label', scaleLabels[s]);
      b.textContent = s === 2 ? 'A' : 'A+';
    });
  }

  /* ---------- Контраст ---------- */
  function syncContrast() {
    var on = root.getAttribute('data-contrast') === 'high';
    document.querySelectorAll('[data-action="contrast"]').forEach(function (b) {
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-action]');
    if (!btn) return;
    if (btn.dataset.action === 'scale') {
      var s = (parseInt(root.getAttribute('data-scale') || '0', 10) + 1) % 3;
      if (s === 0) root.removeAttribute('data-scale'); else root.setAttribute('data-scale', String(s));
      store('rs-scale', String(s));
      syncScale();
    }
    if (btn.dataset.action === 'contrast') {
      var on = root.getAttribute('data-contrast') === 'high';
      if (on) root.removeAttribute('data-contrast'); else root.setAttribute('data-contrast', 'high');
      store('rs-contrast', on ? 'normal' : 'high');
      syncContrast();
    }
  });
  syncScale();
  syncContrast();

  /* ---------- Мобільне меню ---------- */
  var toggle = document.querySelector('.nav-toggle');
  var panel = document.getElementById('nav-panel');
  if (toggle && panel) {
    var setOpen = function (open) {
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      panel.classList.toggle('is-open', open);
    };
    toggle.addEventListener('click', function () {
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });
    panel.addEventListener('click', function (e) {
      if (e.target.closest('a[href^="#"]')) setOpen(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        setOpen(false);
        toggle.focus();
      }
    });
  }

  /* ---------- Форма ---------- */
  var form = document.getElementById('request-form');
  if (!form) return;

  var summary = document.getElementById('error-summary');
  var list = document.getElementById('error-list');
  var statusEl = document.getElementById('form-status');
  var submitBtn = document.getElementById('submit-btn');

  function setError(id, message) {
    var input = document.getElementById(id);
    var out = document.getElementById(id + '-error');
    if (out) out.textContent = message || '';
    if (input && input.type !== 'checkbox') {
      if (message) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
    }
  }

  function looksLikeContact(v) {
    var email = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
    var digits = v.replace(/\D/g, '');
    var phone = /^[+\d\s()\-]+$/.test(v) && digits.length >= 10 && digits.length <= 15;
    return email || phone;
  }

  function validate() {
    var errors = [];
    var org = form.org.value.trim();
    var contact = form.contact.value.trim();

    setError('org', '');
    setError('contact', '');
    setError('consent', '');

    setError('missing', '');
    var d = collect();
    var empty = !d.org && !d.missing && !d.access && !d.docs && !d.objects && !d.score && !d.contact;
    if (empty) {
      errors.push({ id: 'missing', text: 'Заповніть хоча б одне поле — наприклад, напишіть, якої інформації бракує.' });
    }
    if (contact && !looksLikeContact(contact)) {
      errors.push({ id: 'contact', text: 'Вкажіть e-mail (name@mail.com) або телефон із кодом (+380…).' });
    }
    if (contact && !form.consent.checked) {
      errors.push({ id: 'consent', text: 'Щоб ми могли вам написати, погодьтеся на використання контактів.' });
    }

    errors.forEach(function (er) { setError(er.id, er.text); });

    list.innerHTML = '';
    if (errors.length) {
      errors.forEach(function (er) {
        var li = document.createElement('li');
        var a = document.createElement('a');
        a.href = '#' + er.id;
        a.textContent = er.text;
        a.addEventListener('click', function (ev) {
          ev.preventDefault();
          document.getElementById(er.id).focus();
        });
        li.appendChild(a);
        list.appendChild(li);
      });
      summary.hidden = false;
      summary.focus();
    } else {
      summary.hidden = true;
    }
    return errors.length === 0;
  }

  function collect() {
    var fd = new FormData(form);
    var multi = function (name) { return fd.getAll(name).join(', '); };
    return {
      org: (fd.get('org') || '').trim(),
      role: fd.get('role') || '',
      objects: multi('objects'),
      docs: multi('docs'),
      missing: (fd.get('missing') || '').trim(),
      access: (fd.get('access') || '').trim(),
      score: fd.get('score') || '',
      contact: (fd.get('contact') || '').trim(),
      consent: fd.get('consent') ? 'так' : 'ні',
      website: fd.get('website') || '',
      page: location.href
    };
  }

  function showThanks() {
    document.getElementById('form-view').hidden = true;
    var thanks = document.getElementById('thanks-view');
    thanks.hidden = false;
    document.title = 'Дякуємо! — ReStone Tactile';
    window.scrollTo(0, 0);
    document.getElementById('thanks-title').focus();
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!validate()) return;

    var data = collect();
    if (data.website) { showThanks(); return; } // бот

    var endpoint = (window.RESTONE_CONFIG && window.RESTONE_CONFIG.FORM_ENDPOINT) || '';
    if (!endpoint) {
      // Поки таблицю не підключено: показуємо подяку, дані — лише в консолі
      console.info('[ReStone] FORM_ENDPOINT порожній. Дані форми:', data);
      showThanks();
      return;
    }

    submitBtn.disabled = true;
    statusEl.textContent = 'Надсилаємо…';

    // Google Apps Script не повертає CORS-заголовки, тому mode: 'no-cors'.
    // Відповідь прочитати не можна; успіх = запит дійшов без мережевої помилки.
    fetch(endpoint, {
      method: 'POST',
      mode: 'no-cors',
      body: new URLSearchParams(data)
    }).then(function () {
      showThanks();
    }).catch(function () {
      submitBtn.disabled = false;
      statusEl.textContent = 'Не вдалося надіслати. Перевірте інтернет і спробуйте ще раз.';
    });
  });
})();
