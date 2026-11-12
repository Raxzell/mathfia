/*
 * Satu room, dua pemain manusia (Langkah 2).
 * Tidak tahu soal socket: setiap anggota punya fungsi send(event, data).
 * Server otoritatif: klien hanya mengirim aksi, room memanggil mesin game.
 */
'use strict';

var SEATS = 2;
var MAX_TOKENS = 24;
var NAME_MAX = 16;
var RATE_MAX = 10, RATE_WINDOW = 1000; // paling banyak 10 pesan per detik per anggota

function cleanName(name, pid) {
  var s = typeof name === 'string' ? name : '';
  s = s.replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, NAME_MAX);
  return s || 'Pemain ' + (pid + 1);
}

/** Bangun ulang token dari jaringan. Hanya field yang dikenal yang disalin. */
function cleanTokens(x) {
  if (!Array.isArray(x) || x.length === 0 || x.length > MAX_TOKENS) return null;
  var out = [];
  for (var i = 0; i < x.length; i++) {
    var t = x[i];
    if (!t || typeof t !== 'object') return null;
    if (t.t === 'num') {
      if (!Number.isInteger(t.v) || !Number.isInteger(t.card)) return null;
      out.push({ t: 'num', v: t.v, card: t.card });
    } else if (t.t === 'op') {
      if (typeof t.v !== 'string') return null;
      out.push({ t: 'op', v: t.v });
    } else if (t.t === '(' || t.t === ')') {
      out.push({ t: t.t });
    } else {
      return null;
    }
  }
  return out;
}

function Room(opts) {
  opts = opts || {};
  this.G = opts.G;
  this.clock = opts.clock || function () { return Date.now(); };
  this.members = {}; // id koneksi -> { pid, name, send, hits }
  this.seats = [];   // pid -> id koneksi (null kalau sudah putus)
  this.game = new this.G.Game({ rng: opts.rng, clock: this.clock, observeMs: opts.observeMs });
  this.game.on(this.onGame.bind(this));
  this.endHandled = false;
}
var R = Room.prototype;

R.running = function () { var ph = this.game.phase; return ph !== 'idle' && ph !== 'end'; };

R.join = function (id, name, send) {
  if (this.members[id]) return { ok: false, error: 'joined' };
  if (this.running()) return { ok: false, error: 'started' };
  if (this.seats.length >= SEATS) return { ok: false, error: 'full' };
  var pid = this.seats.length;
  this.seats.push(id);
  this.members[id] = { pid: pid, name: cleanName(name, pid), send: send, hits: [] };
  if (this.seats.length === SEATS) this.start();
  else this.broadcastLobby();
  return { ok: true, pid: pid };
};

R.start = function () {
  var self = this;
  this.endHandled = false;
  this.game.newGame({
    seats: this.seats.map(function (id) { return { human: true, name: self.members[id].name }; }),
    decks: 1,
    leaveMode: 'continue'
  });
};

/** Koneksi putus. Di Langkah 2 belum ada reconnect: kursi hanya ditandai putus. */
R.leave = function (id) {
  var m = this.members[id];
  if (!m) return;
  delete this.members[id];
  if (this.running()) {
    this.seats[m.pid] = null;
    this.game.setConnected(m.pid, false);
    var anyone = this.seats.some(function (s) { return s !== null; });
    if (!anyone) this.reset();
  } else {
    // Masih di lobby: susun ulang kursi.
    var self = this;
    this.seats = this.seats.filter(function (s) { return s !== id; });
    this.seats.forEach(function (s, i) { self.members[s].pid = i; });
    this.broadcastLobby();
  }
};

R.reset = function () {
  this.seats = [];
  this.members = {};
  this.game.stop();
};

R.limited = function (m) {
  var now = this.clock();
  m.hits = m.hits.filter(function (t) { return now - t < RATE_WINDOW; });
  if (m.hits.length >= RATE_MAX) return true;
  m.hits.push(now);
  return false;
};

/** Aksi dari klien. Selalu mengembalikan objek kecil, tidak pernah melempar error. */
R.action = function (id, type, payload) {
  var m = this.members[id];
  if (!m) return { ok: false, error: 'notjoined' };
  if (this.limited(m)) return { ok: false, error: 'rate' };
  if (!this.running()) return { ok: false, error: 'phase' };
  var g = this.game;
  try {
    if (type === 'toggle') {
      if (typeof payload !== 'boolean') return { ok: false, error: 'bad' };
      return { ok: g.setOn(m.pid, payload) };
    }
    if (type === 'pick') {
      if (!Number.isInteger(payload)) return { ok: false, error: 'bad' };
      return { ok: g.accuse(m.pid, payload) };
    }
    if (type === 'submit') {
      var toks = cleanTokens(payload);
      if (!toks) return { ok: false, error: 'syntax' };
      var r = g.submit(m.pid, toks);
      if (!r.ok) return { ok: false, error: r.error };
      return { ok: true, is24: !!r.is24, value: this.G.Frac.toString(r.value) };
    }
    return { ok: false, error: 'bad' };
  } catch (e) {
    return { ok: false, error: 'server' };
  }
};

R.tick = function () { if (this.running()) this.game.tick(); };

R.memberOf = function (pid) { var id = this.seats[pid]; return id ? this.members[id] : null; };

R.sendAll = function (ev, data) {
  var self = this;
  Object.keys(this.members).forEach(function (id) { self.members[id].send(ev, data); });
};

R.broadcastLobby = function () {
  var self = this;
  var names = this.seats.map(function (id) { return self.members[id].name; });
  Object.keys(this.members).forEach(function (id) {
    var m = self.members[id];
    m.send('state', { phase: 'lobby', you: m.pid, need: SEATS, players: names, serverNow: self.clock() });
  });
};

R.broadcastState = function () {
  for (var pid = 0; pid < this.seats.length; pid++) {
    var m = this.memberOf(pid);
    if (m) m.send('state', this.game.snapshotFor(pid));
  }
  if (this.game.phase === 'end' && !this.endHandled) {
    // Game selesai: kursi dikosongkan. Pemain harus join lagi untuk game baru.
    this.endHandled = true;
    this.seats = [];
    this.members = {};
  }
};

/** Kejadian mesin -> pesan 'event' kecil. Hanya data yang boleh dilihat semua. */
R.onGame = function (type, d, g) {
  if (type === 'change') { this.broadcastState(); return; }
  var data = null;
  if (type === 'round') data = { round: g.round };
  else if (type === 'toggle') data = { pid: d.pid, on: d.on };
  else if (type === 'pick') data = { accuser: g.accuser };
  else if (type === 'prove') data = { accuser: g.accuser, accused: g.accused };
  else if (type === 'result' || type === 'end') data = {};
  else if (type === 'connection') data = { pid: d.pid, connected: d.connected };
  if (data) this.sendAll('event', { type: type, data: data });
};

module.exports = { Room: Room, cleanTokens: cleanTokens, cleanName: cleanName, SEATS: SEATS };
