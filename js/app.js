// Page logic: theme toggle, tabs, forms, animations.
// Talks to the PHP API when it is running, otherwise falls back to the browser demo store.
(function () {
  'use strict';

  document.documentElement.classList.add('js');

  var API_URL = 'api/auth.php';
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var $ = function (id) { return document.getElementById(id); };
  var vault = $('vault');
  var message = $('message');
  var tabs = { login: $('tabLogin'), register: $('tabRegister') };
  var panels = { login: $('panelLogin'), register: $('panelRegister') };
  var welcome = $('welcome');
  var store = null;

  /* ---------- Backend selection ---------- */

  var ServerStore = {
    mode: 'server',
    call: async function (action, data) {
      var options = { headers: { Accept: 'application/json' }, credentials: 'same-origin' };
      if (data) {
        var body = new FormData();
        body.append('action', action);
        Object.keys(data).forEach(function (k) { body.append(k, data[k]); });
        options.method = 'POST';
        options.body = body;
      }
      var res = await fetch(data ? API_URL : API_URL + '?action=' + action, options);
      return res.json();
    },
    stats: function () { return this.call('stats'); },
    me: function () { return this.call('me'); },
    register: function (d) { return this.call('register', d); },
    login: function (d) { return this.call('login', d); },
    logout: function () { return this.call('logout', {}); }
  };

  async function pickStore() {
    try {
      var res = await fetch(API_URL + '?action=stats', { headers: { Accept: 'application/json' } });
      var type = res.headers.get('content-type') || '';
      if (res.ok && type.indexOf('application/json') !== -1) {
        var json = await res.json();
        if (json && json.ok) return ServerStore;
      }
    } catch (e) {
      // No PHP server (e.g. GitHub Pages): use demo mode.
    }
    return window.DemoStore;
  }

  /* ---------- Theme toggle ---------- */

  function currentTheme() {
    var set = document.documentElement.getAttribute('data-theme');
    if (set) return set;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  $('themeToggle').addEventListener('click', function () {
    var next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch (e) { /* ignore */ }
  });

  /* ---------- Tabs ---------- */

  function showView(view, focus) {
    vault.setAttribute('data-view', view);
    Object.keys(tabs).forEach(function (key) {
      var active = key === view;
      tabs[key].setAttribute('aria-selected', String(active));
      tabs[key].tabIndex = active ? 0 : -1;
      panels[key].hidden = !active;
    });
    if (focus) tabs[view].focus();
    setMessage('');
  }

  Object.keys(tabs).forEach(function (key) {
    tabs[key].addEventListener('click', function () { showView(key); });
    tabs[key].addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        showView(key === 'login' ? 'register' : 'login', true);
      }
    });
  });

  /* ---------- Messages & validation ---------- */

  function setMessage(text, type) {
    message.textContent = text;
    message.className = 'message' + (type ? ' is-' + type : '');
  }

  function shake() {
    if (reduceMotion) return;
    vault.classList.remove('is-shaking');
    void vault.offsetWidth; // restart the animation
    vault.classList.add('is-shaking');
  }

  function validate(form) {
    var firstInvalid = null;
    Array.from(form.querySelectorAll('input:not([type=hidden])')).forEach(function (input) {
      var valid = input.checkValidity();
      input.setAttribute('aria-invalid', String(!valid));
      if (!valid && !firstInvalid) firstInvalid = input;
    });
    if (firstInvalid) {
      firstInvalid.focus();
      var label = form.querySelector('label[for="' + firstInvalid.id + '"]').textContent;
      setMessage('Patikrink laukelį „' + label + '“.', 'error');
      shake();
      return false;
    }
    return true;
  }

  /* ---------- Password strength ---------- */

  var strengthLabels = ['Bent 8 simboliai.', 'Silpnas', 'Vidutinis', 'Geras', 'Labai stiprus'];

  $('regPassword').addEventListener('input', function (e) {
    var v = e.target.value;
    var score = 0;
    if (v.length >= 8) score++;
    if (v.length >= 12) score++;
    if (/[A-ZĄČĘĖĮŠŲŪŽ]/.test(v) && /[a-ząčęėįšųūž]/.test(v)) score++;
    if (/\d/.test(v) && /[^A-Za-z0-9]/.test(v)) score++;
    if (v.length < 8) score = 0;
    $('strengthBar').style.transform = 'scaleX(' + score / 4 + ')';
    $('strengthText').textContent = strengthLabels[score];
  });

  /* ---------- Forms ---------- */

  function formData(form) {
    var data = {};
    new FormData(form).forEach(function (value, key) {
      if (key !== 'action') data[key] = key === 'password' ? value : String(value).trim();
    });
    return data;
  }

  panels.register.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!validate(this)) return;
    var result = await safeCall(function () { return store.register(formData(panels.register)); });
    if (result.ok) {
      var name = panels.register.elements.name.value.trim();
      panels.register.reset();
      $('strengthBar').style.transform = 'scaleX(0)';
      $('strengthText').textContent = strengthLabels[0];
      showView('login');
      panels.login.elements.name.value = name;
      panels.login.elements.password.focus();
      refreshStats();
    } else {
      shake();
    }
    setMessage(result.message, result.ok ? 'ok' : 'error');
  });

  panels.login.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!validate(this)) return;
    var button = this.querySelector('.btn');
    var result = await safeCall(function () { return store.login(formData(panels.login)); });
    if (result.ok) {
      button.classList.add('is-unlocked');
      setTimeout(function () {
        button.classList.remove('is-unlocked');
        panels.login.reset();
        showWelcome(result.user, true);
        setMessage(result.message, 'ok');
      }, reduceMotion ? 0 : 450);
      refreshStats();
    } else {
      setMessage(result.message, 'error');
      shake();
    }
  });

  $('logoutBtn').addEventListener('click', async function () {
    var result = await safeCall(function () { return store.logout(); });
    welcome.hidden = true;
    vault.querySelector('.vault__tabs').hidden = false;
    showView('login');
    setMessage(result.message, result.ok ? 'ok' : 'error');
  });

  async function safeCall(fn) {
    try {
      return await fn();
    } catch (err) {
      return { ok: false, message: 'Nepavyko susisiekti su serveriu. Bandyk dar kartą.' };
    }
  }

  function initials(name) {
    var parts = name.replace(/[_.\-]+/g, ' ').trim().split(/\s+/);
    var letters = parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2);
    return letters.toUpperCase();
  }

  function showWelcome(user, focus) {
    Object.keys(panels).forEach(function (key) { panels[key].hidden = true; });
    vault.querySelector('.vault__tabs').hidden = true;
    $('welcomeName').textContent = user.name;
    $('avatarInitials').textContent = initials(user.name);
    $('welcomeHash').textContent = user.hashPreview;
    welcome.hidden = false;
    if (focus) $('logoutBtn').focus();
  }

  /* ---------- Button ripple ---------- */

  document.addEventListener('pointerdown', function (e) {
    var btn = e.target.closest('.btn');
    if (!btn || reduceMotion) return;
    var rect = btn.getBoundingClientRect();
    var size = Math.max(rect.width, rect.height);
    var dot = document.createElement('span');
    dot.className = 'ripple';
    dot.style.width = dot.style.height = size + 'px';
    dot.style.left = e.clientX - rect.left - size / 2 + 'px';
    dot.style.top = e.clientY - rect.top - size / 2 + 'px';
    var ink = btn.querySelector('.btn__ink');
    if (!ink) {
      ink = document.createElement('span');
      ink.className = 'btn__ink';
      btn.appendChild(ink);
    }
    ink.appendChild(dot);
    dot.addEventListener('animationend', function () { dot.remove(); });
  });

  /* ---------- Count-up numbers ---------- */

  function countUp(el, target) {
    var start = Number(el.textContent) || 0;
    if (reduceMotion || start === target) {
      el.textContent = target;
      return;
    }
    var t0 = performance.now();
    var duration = 900;
    (function tick(now) {
      var p = Math.min((now - t0) / duration, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(start + (target - start) * eased);
      if (p < 1) requestAnimationFrame(tick);
    })(t0);
  }

  async function refreshStats() {
    var s = await safeCall(function () { return store.stats(); });
    if (!s.ok) return;
    countUp($('statUsers'), s.users);
    countUp($('statLogins'), s.logins);
  }

  /* ---------- Reveal on scroll ---------- */

  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        entry.target.querySelectorAll('[data-target]').forEach(function (el) {
          countUp(el, Number(el.dataset.target));
        });
        io.unobserve(entry.target);
      });
    }, { threshold: 0.15 });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('is-visible'); });
  }

  /* ---------- Start ---------- */

  (async function init() {
    store = await pickStore();
    var badge = $('modeBadge');
    badge.textContent = store.mode === 'server' ? '● PHP serveris' : '● Demo režimas';
    badge.title = store.mode === 'server'
      ? 'Duomenys saugomi MySQL duomenų bazėje'
      : 'Duomenys saugomi tik tavo naršyklėje (localStorage)';
    refreshStats();
    var me = await safeCall(function () { return store.me(); });
    if (me.ok && me.user) showWelcome(me.user);
  })();
})();
