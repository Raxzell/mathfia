/*
 * Penghubung antara layar (ui.js) dan sumber game.
 * Dua jenis sesi dengan antarmuka yang sama:
 *   Session.solo()    -> mesin game lokal di browser
 *   Session.online()  -> server lewat Socket.IO
 *
 * Antarmuka:
 *   s.view                  data layar (bentuknya sama dengan snapshotFor, plus remaining())
 *   s.on(fn)                fn(type, data). 'change' = view sudah diperbarui, gambar ulang.
 *   s.toggle(bool)  s.pick(tid)  s.submit(tokens, cb)  s.tick()
 * Kejadian (toggle, round, pick, ...) ditahan sampai state berikutnya tiba,
 * supaya saat handler jalan, view sudah yang terbaru.
 */
(function (G) {
  'use strict';

  var EMPTY = {
    you: 0, phase: 'idle', round: 0, totalRounds: 13, cards: [], deckLeft: 0, accuser: null, accused: null,
    candidates: [], deadline: 0, phaseTotal: 0, serverNow: 0, result: null, standings: [], players: [],
    lobbyNames: [], need: 2
  };

  function Base() {
    this.listeners = [];
    this.queue = [];
    this.offset = 0;
    var self = this;
    this.view = {
      remaining: function () { return Math.max(0, this.deadline - (Date.now() + self.offset)); }
    };
    this.apply(EMPTY);
  }
  var B = Base.prototype;

  B.on = function (fn) { this.listeners.push(fn); };
  B.fire = function (type, data) { this.listeners.forEach(function (f) { f(type, data || {}); }); };

  /** Ganti isi view di tempat, supaya referensi lama tetap benar. */
  B.apply = function (snap) {
    var v = this.view;
    Object.keys(v).forEach(function (k) { if (typeof v[k] !== 'function') delete v[k]; });
    Object.keys(EMPTY).forEach(function (k) { v[k] = EMPTY[k]; });
    Object.keys(snap).forEach(function (k) { v[k] = snap[k]; });
    this.offset = snap.serverNow ? snap.serverNow - Date.now() : 0;
  };

  /** State baru tiba: perbarui view, jalankan kejadian yang menunggu, lalu gambar ulang. */
  B.push = function (snap) {
    var prev = this.view.phase;
    var fresh = snap.phase === 'observe' && snap.round === 1 && prev !== 'observe' &&
      !this.queue.some(function (q) { return q.type === 'newgame'; });
    this.apply(snap);
    var q = this.queue; this.queue = [];
    if (fresh) q.unshift({ type: 'newgame', data: {} });
    for (var i = 0; i < q.length; i++) this.fire(q[i].type, q[i].data);
    this.fire('change');
  };

  // ================= solo =================
  function Solo() {
    Base.call(this);
    var self = this;
    this.mode = 'solo';
    this.observeMs = 90000;
    this.game = new G.Game({ observeMs: this.observeMs });
    this.game.on(function (type, d) {
      if (type === 'change') self.push(self.game.snapshotFor(G.Game.HUMAN));
      else self.queue.push({ type: type, data: d });
    });
  }
  Solo.prototype = Object.create(B);
  var S = Solo.prototype;
  S.start = function (observeMs) {
    this.game.observeMs = observeMs || 90000;
    this.game.newGame();
  };
  S.toggle = function (val) { this.game.setOn(G.Game.HUMAN, val); };
  S.pick = function (tid) { this.game.accuse(G.Game.HUMAN, tid); };
  S.submit = function (tokens, cb) {
    var r = this.game.submit(G.Game.HUMAN, tokens);
    if (cb) cb(r);
  };
  S.next = function () { this.game.next(); };
  S.again = function () { this.game.newGame(); };
  S.stop = function () { this.game.stop(); };
  S.tick = function () { if (this.game.phase !== 'idle') this.game.tick(); };
  S.leave = function () { this.game.stop(); };

  // ================= online =================
  function Online() {
    Base.call(this);
    this.mode = 'online';
    this.socket = null;
    this.nick = '';
  }
  Online.prototype = Object.create(B);
  var O = Online.prototype;

  function loadSocketScript(cb) {
    if (typeof window.io === 'function') return cb(null);
    if (location.protocol !== 'http:' && location.protocol !== 'https:') return cb('file');
    var s = document.createElement('script');
    s.src = '/socket.io/socket.io.js';
    s.onload = function () { cb(typeof window.io === 'function' ? null : 'noserver'); };
    s.onerror = function () { cb('noserver'); };
    document.head.appendChild(s);
  }

  /** cb(err): err null = sudah masuk lobby/game. */
  O.connect = function (nick, cb) {
    var self = this;
    this.nick = nick;
    loadSocketScript(function (err) {
      if (err) return cb(err);
      var sock = window.io({ reconnection: false });
      self.socket = sock;
      var done = false;
      function finish(e) { if (!done) { done = true; cb(e); } }
      sock.on('connect_error', function () { finish('noserver'); });
      sock.on('connect', function () {
        sock.emit('join', { nickname: nick }, function (r) {
          if (r && r.ok) finish(null); else { sock.disconnect(); finish((r && r.error) || 'failed'); }
        });
      });
      sock.on('state', function (st) { self.onState(st); });
      sock.on('event', function (e) { if (e && e.type) self.queue.push({ type: e.type, data: e.data || {} }); });
      sock.on('disconnect', function () {
        if (self.socket !== sock) return;
        self.socket = null;
        self.queue = [];
        self.apply({ phase: 'idle', serverNow: 0 });
        self.fire('disconnected');
        self.fire('change');
      });
    });
  };

  O.onState = function (st) {
    if (st.phase === 'lobby') {
      this.push({ phase: 'lobby', you: st.you, need: st.need, lobbyNames: st.players.slice(), serverNow: st.serverNow });
    } else {
      this.push(st);
    }
  };

  O.toggle = function (val) { if (this.socket) this.socket.emit('toggle', !!val, function () {}); };
  O.pick = function (tid) { if (this.socket) this.socket.emit('pick', tid, function () {}); };
  O.submit = function (tokens, cb) {
    if (!this.socket) return cb && cb({ ok: false, error: 'server' });
    this.socket.emit('submit', tokens, function (r) { if (cb) cb(r || { ok: false, error: 'server' }); });
  };
  /** Setelah game selesai server sudah mengosongkan room, jadi cukup join lagi. */
  O.again = function (cb) {
    var self = this;
    if (!this.socket) return cb && cb('noserver');
    this.socket.emit('join', { nickname: this.nick }, function (r) {
      if (r && r.ok) { if (cb) cb(null); } else { if (cb) cb((r && r.error) || 'failed'); self.leave(); }
    });
  };
  O.tick = function () {};
  O.next = function () {};
  O.leave = function () {
    var sock = this.socket;
    this.socket = null;
    this.queue = [];
    if (sock) sock.disconnect();
    this.apply({ phase: 'idle', serverNow: 0 });
    this.fire('change');
  };

  G.Session = { solo: function () { return new Solo(); }, online: function () { return new Online(); } };
})(globalThis.G24 = globalThis.G24 || {});
