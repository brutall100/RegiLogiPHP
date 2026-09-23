// Demo backend for GitHub Pages (no PHP there).
// Users live in localStorage; passwords are stored only as salted PBKDF2 hashes.
// It exposes the same methods as the PHP API, so app.js does not care which one runs.
(function () {
  'use strict';

  var USERS_KEY = 'demo-users';
  var STATS_KEY = 'demo-logins';
  var SESSION_KEY = 'demo-session';
  var ITERATIONS = 150000;

  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      // Storage unavailable: demo still works for this page view.
    }
  }

  function toHex(buffer) {
    return Array.from(new Uint8Array(buffer))
      .map(function (b) { return b.toString(16).padStart(2, '0'); })
      .join('');
  }

  function fromHex(hex) {
    var bytes = new Uint8Array(hex.length / 2);
    for (var i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return bytes;
  }

  async function derive(password, salt) {
    var key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    var bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt, iterations: ITERATIONS }, key, 256);
    return toHex(bits);
  }

  async function hashPassword(password) {
    var salt = crypto.getRandomValues(new Uint8Array(16));
    return 'pbkdf2$' + ITERATIONS + '$' + toHex(salt) + '$' + (await derive(password, salt));
  }

  async function verifyPassword(password, stored) {
    var parts = stored.split('$');
    return (await derive(password, fromHex(parts[2]))) === parts[3];
  }

  function preview(hash) {
    return hash.slice(0, 18) + '…' + hash.slice(-6);
  }

  function findUser(users, name) {
    var lower = name.toLowerCase();
    return users.find(function (u) { return u.name.toLowerCase() === lower; });
  }

  window.DemoStore = {
    mode: 'demo',

    async stats() {
      return { ok: true, users: read(USERS_KEY, []).length, logins: read(STATS_KEY, 0) };
    },

    async me() {
      var name = read(SESSION_KEY, null);
      var user = name && findUser(read(USERS_KEY, []), name);
      return { ok: true, user: user ? { name: user.name, hashPreview: preview(user.hash) } : null };
    },

    async register(data) {
      var users = read(USERS_KEY, []);
      var email = data.email.toLowerCase();
      if (findUser(users, data.name) || users.some(function (u) { return u.email === email; })) {
        return { ok: false, message: 'Toks vartotojas arba el. paštas jau užregistruotas.' };
      }
      users.push({ name: data.name, email: email, hash: await hashPassword(data.password) });
      write(USERS_KEY, users);
      return { ok: true, message: 'Paskyra sukurta! Dabar prisijunk.' };
    },

    async login(data) {
      var user = findUser(read(USERS_KEY, []), data.name);
      if (!user || !(await verifyPassword(data.password, user.hash))) {
        return { ok: false, message: 'Neteisingas vardas arba slaptažodis.' };
      }
      write(SESSION_KEY, user.name);
      write(STATS_KEY, read(STATS_KEY, 0) + 1);
      return { ok: true, message: 'Prisijungta!', user: { name: user.name, hashPreview: preview(user.hash) } };
    },

    async logout() {
      try { localStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ }
      return { ok: true, message: 'Atsijungta.' };
    }
  };
})();
