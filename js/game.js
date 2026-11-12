/*
 * Mesin game. Tidak menyentuh layar dan tidak tahu soal host atau jaringan.
 * UI (solo) atau server (online) memanggil tick() berkala.
 * Fase: idle -> observe -> (pick -> prove) -> result -> observe ... -> end
 *
 * Kursi: 2 sampai 4, manusia atau bot. id pemain = indeks di this.players dan
 * tidak pernah berubah. Pemain yang keluar ditandai `out`, tidak dihapus.
 */
(function (G) {
  'use strict';

  var T_OBSERVE = 90000, T_PROVE = 30000, T_PICK_HUMAN = 15000, T_RESULT = 8000;
  var ROUNDS_PER_DECK = 13, MIN_SEATS = 2, MAX_SEATS = 4, MAX_DECKS = 3;
  var ROUNDS = ROUNDS_PER_DECK; // bawaan: 1 dek
  var HUMAN = 3;                // bawaan solo: manusia di kursi 3
  var REPLACE_PERSONA = 'medium';

  // Susunan bawaan solo: 3 bot + 1 manusia.
  function defaultSeats() {
    return [
      { name: 'Bot A', persona: 'honest', human: false },
      { name: 'Bot B', persona: 'bluffer', human: false },
      { name: 'Bot C', persona: 'medium', human: false },
      { name: null, persona: null, human: true }
    ];
  }

  function rand(rng, a, b) { return a + rng() * (b - a); }

  function Game(opts) {
    opts = opts || {};
    this.rng = opts.rng || Math.random;
    this.clock = opts.clock || function () { return Date.now(); };
    this.listeners = [];
    this.observeMs = opts.observeMs || T_OBSERVE; // fase membuktikan selalu 30 detik
    this.totalRounds = ROUNDS;
    this.phase = 'idle';
  }
  var P = Game.prototype;

  P.on = function (fn) { this.listeners.push(fn); };
  P.emit = function (type, data) {
    var self = this;
    this.listeners.forEach(function (f) { f(type, data || {}, self); });
  };

  P.setTimer = function (ms) {
    var now = this.clock();
    this.phaseStart = now;
    this.phaseTotal = ms;
    this.deadline = now + ms;
  };
  P.remaining = function () { return Math.max(0, this.deadline - this.clock()); };

  /** Pemain yang masih ikut (belum out). */
  P.active = function () { return this.players.filter(function (p) { return !p.out; }); };

  P.freshDeck = function () {
    this.deck = G.Deck.shuffle(G.Deck.makeDeck(), this.rng === Math.random ? null : this.rng);
    this.deckNo++;
  };

  /**
   * Mulai game baru.
   * cfg.seats     [{name, human, persona}] 2..4 kursi (bawaan: 3 bot + 1 manusia)
   * cfg.decks     1..3 (bawaan 1). Total ronde = 13 x dek.
   * cfg.leaveMode 'bot' = kursi yang ditinggal diganti bot, 'continue' = lanjut tanpa dia
   * online: hanya dipanggil server.
   */
  P.newGame = function (cfg) {
    cfg = cfg || {};
    var seats = cfg.seats || defaultSeats();
    if (!Array.isArray(seats) || seats.length < MIN_SEATS || seats.length > MAX_SEATS) throw new Error('seats');
    var decks = cfg.decks === undefined ? 1 : cfg.decks;
    if (decks !== 1 && decks !== 2 && decks !== 3) throw new Error('decks');
    this.decks = decks;
    this.totalRounds = ROUNDS_PER_DECK * decks;
    this.leaveMode = cfg.leaveMode === 'continue' ? 'continue' : 'bot';
    this.players = seats.map(function (s, i) {
      var human = !!s.human;
      return {
        id: i, name: s.name === undefined ? null : s.name, human: human,
        persona: human ? null : (s.persona || REPLACE_PERSONA),
        penalty: 0, on: false, onOrder: 0, plan: null,
        out: false, connected: true, leaving: false
      };
    });
    this.deckNo = 0;
    this.freshDeck();
    this.round = 0;
    this.discard = 0;
    this.result = null;
    this.emit('newgame');
    this.startRound();
  };

  /** Kembali ke menu. Game berhenti. online: hanya dipanggil server. */
  P.stop = function () {
    this.phase = 'idle';
    this.emit('change');
  };

  P.startRound = function () {
    var self = this;
    if (this.deck.length < 4) this.freshDeck(); // dek baru tiap 13 ronde
    this.round++;
    this.cards = this.deck.splice(0, 4);
    this.solution = G.Solver.solve(this.cards);
    this.phase = 'observe';
    this.setTimer(this.observeMs);
    this.accuser = null; this.accused = null; this.candidates = [];
    this.result = null; this.pressured = false; this.onSeq = 0; this.botPick = null; this.proveAt = 0;
    this.players.forEach(function (p) {
      p.on = false; p.onOrder = 0;
      p.plan = (p.human || p.out) ? null : G.Bot.planRound(p.persona, self.solution, self.rng, self.observeMs / 1000);
    });
    this.emit('round');
    this.emit('change');
  };

  // ---------- koneksi dan keluar ----------

  /** Tandai putus / tersambung. Tidak mengubah aturan ronde. Jendela reconnect diatur server. */
  P.setConnected = function (pid, val) {
    var p = this.players && this.players[pid];
    if (!p || !p.human) return false;
    p.connected = !!val;
    this.emit('connection', { pid: pid, connected: p.connected });
    return true;
  };

  /**
   * Pemain manusia pergi (jendela reconnect habis, atau keluar sendiri).
   * Penggantian baru terjadi di batas ronde. Di tengah ronde dia tetap di kursinya,
   * dan aturan waktu habis berlaku seperti biasa.
   */
  P.leave = function (pid) {
    var p = this.players && this.players[pid];
    if (!p || !p.human || p.out) return false;
    p.leaving = true;
    p.connected = false;
    this.emit('leaving', { pid: pid });
    return true;
  };

  /** Dipanggil di batas ronde. Mengembalikan true kalau game masih bisa lanjut. */
  P.applyLeaves = function () {
    var self = this;
    this.players.forEach(function (p) {
      if (!p.leaving) return;
      p.leaving = false;
      if (self.leaveMode === 'bot') {
        p.human = false;
        p.persona = REPLACE_PERSONA;
        p.connected = true;
        self.emit('replaced', { pid: p.id });
      } else {
        p.out = true;
        p.on = false;
        self.emit('out', { pid: p.id });
      }
    });
    return this.active().length >= MIN_SEATS;
  };

  // ---------- fase pengamatan ----------

  /** Nyalakan / matikan saklar. Hanya saat fase pengamatan, dan hanya untuk pemain aktif. */
  P.setOn = function (pid, val) {
    if (this.phase !== 'observe') return false;
    var p = this.players[pid];
    if (!p || p.out) return false;
    val = !!val;
    if (p.on === val) return false;
    p.on = val;
    p.onOrder = val ? ++this.onSeq : 0;
    this.emit('toggle', { pid: pid, on: val });
    this.checkTrigger();
    this.emit('change');
    return true;
  };

  P.checkTrigger = function () {
    var act = this.active();
    var on = act.filter(function (p) { return p.on; });
    var off = act.filter(function (p) { return !p.on; });
    // Tinggal tepat 2 pemain aktif yang OFF: bot yang belum nemu bisa ikut bluff.
    if (off.length === 2 && on.length > 0 && !this.pressured) {
      this.pressured = true;
      var el = (this.clock() - this.phaseStart) / 1000, rng = this.rng;
      off.forEach(function (p) {
        if (!p.human) G.Bot.maybePressure(p.persona, p.plan, el, rng);
      });
    }
    // Ronde terkunci begitu paling banyak 1 pemain aktif yang OFF.
    if (act.length >= MIN_SEATS && off.length <= 1) {
      // Tepat 1 OFF: dia menuding. Semua ON: yang ON paling akhir menuding.
      var acc = off.length === 1 ? off[0] : on.reduce(function (a, b) { return b.onOrder > a.onOrder ? b : a; });
      this.startPick(acc);
    }
  };

  // ---------- penudingan dan pembuktian ----------

  P.startPick = function (acc) {
    this.phase = 'pick';
    this.accuser = acc.id;
    this.candidates = this.players
      .filter(function (p) { return !p.out && p.on && p.id !== acc.id; })
      .map(function (p) { return p.id; });
    if (acc.human) {
      this.setTimer(T_PICK_HUMAN);
    } else {
      this.setTimer(rand(this.rng, 1600, 2800));
      var self = this;
      this.botPick = G.Bot.chooseTarget(this.candidates.map(function (id) { return self.players[id]; }), this.rng);
    }
    this.emit('pick');
  };

  /**
   * accuse(pid, tid): pid harus penuding.
   * accuse(tid) dengan satu argumen = cara lama untuk solo (pid dianggap penuding).
   * online: server WAJIB selalu mengirim dua argumen.
   */
  P.accuse = function (pid, tid) {
    if (arguments.length < 2) { tid = pid; pid = this.accuser; }
    if (this.phase !== 'pick' || pid !== this.accuser) return false;
    if (this.candidates.indexOf(tid) < 0) return false;
    this.startProve(tid);
    this.emit('change');
    return true;
  };

  P.startProve = function (tid) {
    this.phase = 'prove';
    this.accused = tid;
    this.setTimer(T_PROVE);
    if (!this.players[tid].human) this.proveAt = this.clock() + rand(this.rng, 2500, 5000);
    this.emit('prove');
  };

  /**
   * submit(pid, tokens): pid harus yang dituding, dan dia manusia.
   * submit(tokens) dengan satu argumen = cara lama untuk solo.
   * Rumus yang belum sah ditolak tanpa mengakhiri ronde.
   * online: server WAJIB selalu mengirim dua argumen.
   */
  P.submit = function (pid, tokens) {
    if (arguments.length < 2) { tokens = pid; pid = this.accused; }
    if (this.phase !== 'prove' || pid !== this.accused || !this.players[pid].human) return { ok: false, error: 'phase' };
    var r = G.Parser.check(tokens, this.cards);
    if (!r.ok) return r;
    this.finishProof(r.is24, {
      expr: G.Parser.toText(tokens),
      value: G.Frac.toString(r.value),
      reason: r.is24 ? null : 'wrong'
    });
    return r;
  };

  P.give = function (pid, k) { this.players[pid].penalty += k; };

  P.finishProof = function (success, info) {
    var loser = success ? this.accuser : this.accused;
    this.give(loser, 4);
    this.endRound({
      kind: 'proof', success: success, accuser: this.accuser, accused: this.accused,
      expr: info.expr || null, value: info.value || null, reason: info.reason || null,
      gains: [{ pid: loser, k: 4 }], discarded: 0
    });
  };

  P.observeTimeout = function () {
    var self = this;
    var act = this.active();
    var on = act.filter(function (p) { return p.on; });
    var off = act.filter(function (p) { return !p.on; });
    if (on.length === 0) {
      this.discard += 4;
      this.endRound({ kind: 'pass', gains: [], discarded: 4 });
      return;
    }
    // Kartu dibagi rata ke yang masih OFF. Sisa dibuang.
    var per = Math.floor(4 / off.length);
    var gains = off.map(function (p) { return { pid: p.id, k: per }; });
    gains.forEach(function (g) { self.give(g.pid, g.k); });
    var disc = 4 - per * off.length;
    this.discard += disc;
    this.endRound({ kind: 'split', gains: gains, discarded: disc });
  };

  P.endRound = function (result) {
    result.solution = this.solution;
    this.result = result;
    this.phase = 'result';
    this.setTimer(T_RESULT);
    this.emit('result');
    this.emit('change');
  };

  /**
   * Batas ronde: ganti/keluarkan pemain yang pergi, lalu ronde berikutnya atau selesai.
   * Dipanggil tick() setelah 8 detik. online: jangan jadikan pesan yang bisa dikirim klien.
   */
  P.next = function () {
    if (this.phase !== 'result') return;
    var canGo = this.applyLeaves();
    if (!canGo || this.round >= this.totalRounds) {
      this.phase = 'end';
      this.emit('end');
      this.emit('change');
    } else {
      this.startRound();
    }
  };

  P.tick = function () {
    var now = this.clock();
    if (this.phase === 'observe') {
      var el = (now - this.phaseStart) / 1000;
      for (var i = 0; i < this.players.length && this.phase === 'observe'; i++) {
        var p = this.players[i];
        if (!p.plan || p.out) continue;
        for (var k = 0; k < p.plan.actions.length && this.phase === 'observe'; k++) {
          var a = p.plan.actions[k];
          if (!a.done && a.at <= el) { a.done = true; this.setOn(p.id, a.on); }
        }
      }
      if (this.phase === 'observe' && now >= this.deadline) this.observeTimeout();
    } else if (this.phase === 'pick') {
      if (now >= this.deadline) {
        var acc = this.players[this.accuser];
        var t = acc.human
          ? this.candidates[Math.floor(this.rng() * this.candidates.length)]
          : this.botPick;
        this.accuse(this.accuser, t);
      }
    } else if (this.phase === 'prove') {
      var ac = this.players[this.accused];
      if (!ac.human && now >= this.proveAt) {
        if (ac.plan && ac.plan.knows) this.finishProof(true, { expr: G.Parser.pretty(ac.plan.expr) });
        else this.finishProof(false, { reason: 'bluff' });
      } else if (now >= this.deadline) {
        this.finishProof(false, { reason: 'timeout' });
      }
    } else if (this.phase === 'result') {
      if (now >= this.deadline) this.next();
    }
  };

  /**
   * Urutan skor. Sedikit = menang, banyak = kalah, sama semua = seri.
   * Pemain `out` tetap tampil, selalu dihitung kalah, dan ditaruh paling bawah.
   */
  P.standings = function () {
    var act = this.players.filter(function (p) { return !p.out; })
      .sort(function (a, b) { return a.penalty - b.penalty; });
    var outs = this.players.filter(function (p) { return p.out; })
      .sort(function (a, b) { return a.penalty - b.penalty; });
    var anyOut = outs.length > 0;
    var min = act.length ? act[0].penalty : 0, max = act.length ? act[act.length - 1].penalty : 0;
    var rows = act.map(function (p) {
      var tag;
      if (anyOut) tag = p.penalty === min ? 'winner' : '';
      else tag = min === max ? 'draw' : p.penalty === min ? 'winner' : p.penalty === max ? 'loser' : '';
      return { id: p.id, penalty: p.penalty, tag: tag, out: false };
    });
    return rows.concat(outs.map(function (p) { return { id: p.id, penalty: p.penalty, tag: 'loser', out: true }; }));
  };

  // ---------- snapshot untuk klien ----------

  function copyCard(c) { return { rank: c.rank, suit: c.suit, id: c.id }; }

  function copyResult(r) {
    if (!r) return null;
    return {
      kind: r.kind, success: r.success === undefined ? null : r.success,
      accuser: r.accuser === undefined ? null : r.accuser,
      accused: r.accused === undefined ? null : r.accused,
      expr: r.expr || null, value: r.value || null, reason: r.reason || null,
      gains: (r.gains || []).map(function (g) { return { pid: g.pid, k: g.k }; }),
      discarded: r.discarded || 0,
      // Solusi baru boleh dilihat setelah ronde selesai.
      solution: r.solution ? { expr: r.solution.expr } : null
    };
  }

  /**
   * Data yang boleh dilihat pemain pid. Hanya field di whitelist ini yang dikirim.
   * Tidak pernah memuat: deck, solution ronde berjalan, plan bot, botPick, onOrder.
   */
  P.snapshotFor = function (pid) {
    var ph = this.phase, end = ph === 'end';
    var showResult = ph === 'result' || end;
    var inGame = ph !== 'idle' && !!this.players;
    return {
      you: pid,
      phase: ph,
      round: this.round || 0,
      totalRounds: this.totalRounds,
      cards: inGame && this.cards ? this.cards.map(copyCard) : [],
      deckLeft: inGame && this.deck ? this.deck.length : 0,
      accuser: inGame ? this.accuser : null,
      accused: inGame ? this.accused : null,
      candidates: inGame && this.candidates ? this.candidates.slice() : [],
      deadline: this.deadline || 0,
      phaseTotal: this.phaseTotal || 0,
      serverNow: this.clock(),
      result: showResult ? copyResult(this.result) : null,
      players: (this.players || []).map(function (p) {
        var o = { id: p.id, name: p.name, human: p.human, on: p.on, penalty: p.penalty, out: p.out };
        if (end) o.persona = p.persona;
        return o;
      })
    };
  };

  Game.ROUNDS = ROUNDS;
  Game.ROUNDS_PER_DECK = ROUNDS_PER_DECK;
  Game.HUMAN = HUMAN;
  Game.MIN_SEATS = MIN_SEATS;
  Game.MAX_SEATS = MAX_SEATS;
  Game.MAX_DECKS = MAX_DECKS;
  G.Game = Game;
})(globalThis.G24 = globalThis.G24 || {});
