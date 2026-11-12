/*
 * Mesin game. Tidak menyentuh layar. UI memanggil tick() berkala.
 * Fase: observe -> (pick -> prove) -> result -> observe ... -> end
 */
(function (G) {
  'use strict';

  var T_OBSERVE = 90000, T_PROVE = 30000, T_PICK_HUMAN = 15000, T_RESULT = 8000, ROUNDS = 13;
  var HUMAN = 3;

  function rand(rng, a, b) { return a + rng() * (b - a); }

  function Game(opts) {
    opts = opts || {};
    this.rng = opts.rng || Math.random;
    this.clock = opts.clock || function () { return Date.now(); };
    this.listeners = [];
    this.observeMs = opts.observeMs || T_OBSERVE; // fase membuktikan selalu 30 detik
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

  P.newGame = function () {
    this.deck = G.Deck.shuffle(G.Deck.makeDeck(), this.rng === Math.random ? null : this.rng);
    this.players = [
      { id: 0, name: 'Bot A', persona: 'honest', human: false },
      { id: 1, name: 'Bot B', persona: 'bluffer', human: false },
      { id: 2, name: 'Bot C', persona: 'medium', human: false },
      { id: 3, name: null, persona: null, human: true }
    ];
    this.players.forEach(function (p) { p.penalty = 0; p.on = false; p.onOrder = 0; p.plan = null; });
    this.round = 0;
    this.discard = 0;
    this.result = null;
    this.emit('newgame');
    this.startRound();
  };

  /** Kembali ke menu. Game berhenti. */
  P.stop = function () {
    this.phase = 'idle';
    this.emit('change');
  };

  P.startRound = function () {
    var self = this;
    this.round++;
    this.cards = this.deck.splice(0, 4);
    this.solution = G.Solver.solve(this.cards);
    this.phase = 'observe';
    this.setTimer(this.observeMs);
    this.accuser = null; this.accused = null; this.candidates = [];
    this.result = null; this.pressured = false; this.onSeq = 0; this.botPick = null; this.proveAt = 0;
    this.players.forEach(function (p) {
      p.on = false; p.onOrder = 0;
      p.plan = p.human ? null : G.Bot.planRound(p.persona, self.solution, self.rng, self.observeMs / 1000);
    });
    this.emit('round');
    this.emit('change');
  };

  /** Nyalakan / matikan saklar. Hanya saat fase pengamatan. */
  P.setOn = function (pid, val) {
    if (this.phase !== 'observe') return false;
    var p = this.players[pid];
    if (p.on === val) return false;
    p.on = val;
    p.onOrder = val ? ++this.onSeq : 0;
    this.emit('toggle', { pid: pid, on: val });
    this.checkTrigger();
    this.emit('change');
    return true;
  };

  P.checkTrigger = function () {
    var on = this.players.filter(function (p) { return p.on; });
    if (on.length === 2 && !this.pressured) {
      this.pressured = true;
      var el = (this.clock() - this.phaseStart) / 1000, rng = this.rng;
      this.players.forEach(function (p) {
        if (!p.human && !p.on) G.Bot.maybePressure(p.persona, p.plan, el, rng);
      });
    }
    if (on.length >= 3) {
      var off = this.players.filter(function (p) { return !p.on; });
      // 3 ON + 1 OFF: yang OFF menuding. Semua ON: yang ON paling akhir menuding.
      var acc = off.length === 1 ? off[0] : on.reduce(function (a, b) { return b.onOrder > a.onOrder ? b : a; });
      this.startPick(acc);
    }
  };

  P.startPick = function (acc) {
    this.phase = 'pick';
    this.accuser = acc.id;
    this.candidates = this.players
      .filter(function (p) { return p.on && p.id !== acc.id; })
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

  P.accuse = function (tid) {
    if (this.phase !== 'pick' || this.candidates.indexOf(tid) < 0) return false;
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

  /** Rumus dari pemain manusia. Rumus yang belum sah ditolak tanpa mengakhiri ronde. */
  P.submit = function (tokens) {
    if (this.phase !== 'prove' || !this.players[this.accused].human) return { ok: false, error: 'phase' };
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
    var on = this.players.filter(function (p) { return p.on; });
    var off = this.players.filter(function (p) { return !p.on; });
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

  P.next = function () {
    if (this.phase !== 'result') return;
    if (this.round >= ROUNDS) {
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
        if (!p.plan) continue;
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
        this.accuse(t);
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

  /** Urutan skor. Sedikit = menang, banyak = kalah, sama semua = seri. */
  P.standings = function () {
    var ps = this.players.slice().sort(function (a, b) { return a.penalty - b.penalty; });
    var min = ps[0].penalty, max = ps[ps.length - 1].penalty;
    return ps.map(function (p) {
      var tag = min === max ? 'draw' : p.penalty === min ? 'winner' : p.penalty === max ? 'loser' : '';
      return { id: p.id, penalty: p.penalty, tag: tag };
    });
  };

  Game.ROUNDS = ROUNDS;
  Game.HUMAN = HUMAN;
  G.Game = Game;
})(globalThis.G24 = globalThis.G24 || {});
