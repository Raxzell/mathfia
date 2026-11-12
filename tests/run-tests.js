/* Jalankan: node tests/run-tests.js */
'use strict';
var path = require('path');
['fraction', 'cards', 'deck', 'solver', 'parser', 'bot', 'game'].forEach(function (f) {
  require(path.join(__dirname, '..', 'js', f + '.js'));
});
var G = globalThis.G24;
var pass = 0, failN = 0;
function ok(cond, msg) { if (cond) pass++; else { failN++; console.log('FAIL:', msg); } }

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    var t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function card(rank, suit) { return { rank: rank, suit: suit || 'S' }; }
function evalStr(s) { var r = G.Parser.evaluate(G.Parser.tokenize(s)); return r.ok ? G.Frac.toString(r.value) : r.error; }

// --- Dek
var deck = G.Deck.makeDeck();
ok(deck.length === 52, 'dek 52');
ok(new Set(deck.map(function (c) { return c.id; })).size === 52, 'dek unik');
ok(G.Deck.shuffle(deck).length === 52, 'kocok tetap 52');
ok(JSON.stringify(G.Deck.values(card('A'))) === '[1,11]', 'As 1/11');
ok(G.Deck.values(card('K'))[0] === 10 && G.Deck.values(card('7'))[0] === 7, 'nilai K dan 7');

// --- Parser
ok(evalStr('(1 + 11) * 2') === '24', 'kurung');
ok(evalStr('2 + 3 * 4') === '14', 'urutan operasi');
ok(evalStr('8 / (3 - 8 / 3)') === '24', 'pecahan pasti');
ok(evalStr('8 / (3 - 3)') === 'div0', 'bagi nol');
ok(evalStr('(2 + 3') === 'syntax', 'kurung tidak tutup');
ok(evalStr('2 3') === 'syntax', 'angka berdempet');
ok(evalStr('- 2 + 3') === 'syntax', 'minus depan ditolak');
ok(G.Parser.tokenize('alert(1)') === null, 'huruf ditolak');

var cards = [card('A'), card('Q', 'H'), card('4', 'C'), card('6', 'D')];
function tk(list) { return list.map(function (x) { return typeof x === 'object' ? x : (x === '(' || x === ')' ? { t: x } : { t: 'op', v: x }); }); }
var good = tk([{ t: 'num', v: 10, card: 1 }, '*', { t: 'num', v: 6, card: 3 }, '/', { t: 'num', v: 4, card: 2 }, '+', { t: 'num', v: 9, card: 0 }]);
ok(G.Parser.check(good, cards).error === 'value', 'nilai As 9 ditolak');
var r1 = G.Parser.check(tk([{ t: 'num', v: 11, card: 0 }, '-', { t: 'num', v: 10, card: 1 }, '+', { t: 'num', v: 4, card: 2 }, '*', { t: 'num', v: 6, card: 3 }]), cards);
ok(r1.ok && r1.is24 === false, '11-10+24 = 25 bukan 24');
var r2 = G.Parser.check(tk(['(', { t: 'num', v: 1, card: 0 }, '-', { t: 'num', v: 10, card: 1 }, '+', { t: 'num', v: 4, card: 2 }, ')', '*', { t: 'num', v: 6, card: 3 }]), cards);
ok(r2.ok && G.Frac.toString(r2.value) === '-30', '(1-10+4)*6 = -30');
var dup = tk([{ t: 'num', v: 10, card: 1 }, '+', { t: 'num', v: 10, card: 1 }, '+', { t: 'num', v: 4, card: 2 }]);
ok(G.Parser.check(dup, cards).error === 'cards', 'kartu dipakai dua kali ditolak');

// --- Parser tahan input sembarangan (dari jaringan)
function noThrow(fn) { try { return fn(); } catch (e) { return 'THROW:' + e.message; } }
[null, undefined, 5, 'abc', {}, [null], [undefined], [5], ['+'], [{}], [{ t: 'num', v: '7' }], [{ t: 'num', v: 1.5 }],
  [{ t: 'op', v: '%' }], [{ t: 'op', v: 'constructor' }], [{ t: 'x' }], [{ t: 'num', v: Infinity }]
].forEach(function (bad, i) {
  var e = noThrow(function () { return G.Parser.evaluate(bad); });
  var c = noThrow(function () { return G.Parser.check(bad, cards); });
  ok(e && e.ok === false && c && c.ok === false, 'token rusak ditolak tanpa crash #' + i);
});
ok(G.Parser.evaluate([]).error === 'empty' && G.Parser.check([], cards).error === 'empty', 'array kosong = empty');
var deep = [];
for (var d = 0; d < 5000; d++) deep.push({ t: '(' });
ok(noThrow(function () { return G.Parser.evaluate(deep).error; }) === 'syntax', 'array sangat panjang ditolak');
var deep9 = G.Parser.tokenize('(((((((((1)))))))))');
ok(deep9.length <= 24 && G.Parser.evaluate(deep9).error === 'syntax', 'kurung lebih dari 8 lapis ditolak');
ok(evalStr('((((((((24))))))))') === '24', 'kurung 8 lapis masih boleh');

// --- Solver
function verify(vals) {
  var s = G.Solver.solve(vals);
  if (!s) return null;
  return evalStr(s.expr) === '24' ? s : 'BAD:' + s.expr;
}
var s338 = verify([[3], [3], [8], [8]]);
ok(s338 && typeof s338 === 'object', '3 3 8 8 bisa');
ok(verify([[1, 11], [1, 11], [1, 11], [1, 11]]) !== null, 'empat As bisa (11+11+1+1)');
ok(verify([[2], [2], [2], [2]]) === null, '2 2 2 2 mustahil');
var solvable = 0, total = 0, bad = 0;
for (var t = 0; t < 400; t++) {
  var hand = G.Deck.shuffle(deck, mulberry32(t)).slice(0, 4);
  var v = verify(hand);
  total++;
  if (typeof v === 'string') bad++;
  if (v) solvable++;
}
ok(bad === 0, 'semua rumus solver benar-benar 24');
console.log('Kartu acak yang bisa: ' + solvable + '/' + total);

// --- Simulasi satu game penuh
function simulate(seed, humanPlays) {
  var now = 0, rng = mulberry32(seed);
  var g = new G.Game({ rng: rng, clock: function () { return now; } });
  g.newGame();
  var steps = 0;
  while (g.phase !== 'end' && steps < 200000) {
    if (humanPlays && g.phase === 'observe' && rng() < 0.002) g.setOn(3, !g.players[3].on);
    if (humanPlays && g.phase === 'prove' && g.accused === 3 && g.solution && rng() < 0.01) {
      var usedC = {};
      var toks = G.Parser.tokenize(g.solution.expr).map(function (x) {
        if (x.t !== 'num') return x;
        for (var c = 0; c < 4; c++) {
          if (!usedC[c] && G.Deck.values(g.cards[c]).indexOf(x.v) >= 0) { usedC[c] = 1; return { t: 'num', v: x.v, card: c }; }
        }
        return x;
      });
      var sr = g.submit(toks);
      ok(sr.ok && sr.is24, 'manusia kirim solusi solver = 24');
    }
    now += 100; g.tick(); steps++;
  }
  var pens = g.players.reduce(function (a, p) { return a + p.penalty; }, 0);
  return { g: g, pens: pens };
}
for (var sd = 1; sd <= 30; sd++) {
  var res = simulate(sd, sd % 2 === 0);
  ok(res.g.phase === 'end', 'game selesai (seed ' + sd + ')');
  ok(res.g.round === 13, '13 ronde (seed ' + sd + ')');
  ok(res.pens + res.g.discard === 52, 'kartu total 52 (seed ' + sd + ')');
}

// --- Aturan tudingan
(function () {
  var now = 0;
  var g = new G.Game({ rng: mulberry32(7), clock: function () { return now; } });
  g.newGame();
  g.players.forEach(function (p) { if (p.plan) p.plan.actions = []; });
  g.setOn(0, true); g.setOn(1, true); g.setOn(3, true);
  ok(g.phase === 'pick' && g.accuser === 2, 'yang OFF terakhir jadi penuding');
  ok(g.candidates.join() === '0,1,3', 'kandidat = yang ON');
  now += 3000; g.tick();
  ok(g.phase === 'prove', 'bot penuding memilih');
})();
(function () {
  var now = 0;
  var g = new G.Game({ rng: mulberry32(9), clock: function () { return now; } });
  g.newGame();
  g.players.forEach(function (p) { if (p.plan) p.plan.actions = []; });
  g.setOn(0, true);
  now = g.observeMs + 1; g.tick();
  ok(g.result.kind === 'split' && g.result.discarded === 1, '1 ON: 3 OFF dapat 1, 1 dibuang');
  ok(g.players[1].penalty === 1 && g.players[0].penalty === 0, 'yang ON aman');
})();
(function () {
  var now = 0;
  var g = new G.Game({ rng: mulberry32(11), clock: function () { return now; } });
  g.newGame();
  g.players.forEach(function (p) { if (p.plan) p.plan.actions = []; });
  g.setOn(0, true); g.setOn(3, true);
  now = g.observeMs + 1; g.tick();
  ok(g.players[1].penalty === 2 && g.players[2].penalty === 2, '2 ON: 2 OFF dapat 2');
})();
(function () {
  var now = 0;
  var g = new G.Game({ rng: mulberry32(13), clock: function () { return now; } });
  g.newGame();
  g.players.forEach(function (p) { if (p.plan) p.plan.actions = []; });
  now = g.observeMs + 1; g.tick();
  ok(g.result.kind === 'pass' && g.discard === 4, 'semua OFF: dibuang');
})();

// =====================================================================
// Langkah 1 online: kursi dinamis, banyak dek, keluar, snapshot
// =====================================================================
var H = function (n) { return { human: true, name: n || 'H' }; };
var B = function (n, persona) { return { human: false, name: n || 'B', persona: persona || 'honest' }; };

/** Game dengan jam palsu. Bot dibuat diam (tanpa aksi) kalau quiet = true. */
function mk(cfg, seed, quiet) {
  var clock = { now: 0 };
  var g = new G.Game({ rng: mulberry32(seed || 1), clock: function () { return clock.now; } });
  if (quiet) g.on(function (type, d, gg) { if (type === 'round') gg.players.forEach(function (p) { if (p.plan) p.plan.actions = []; }); });
  g.newGame(cfg);
  return { g: g, c: clock };
}
function timeOut(t) { t.c.now = t.g.deadline + 1; t.g.tick(); }
function sameSet(a, b) { return a.slice().sort().join() === b.slice().sort().join(); }

// --- Bawaan solo tidak berubah
(function () {
  var g0 = new G.Game();
  ok(g0.totalRounds === 13, 'totalRounds bawaan 13 sebelum newGame');
  var t = mk(undefined, 3);
  ok(t.g.players.length === 4 && t.g.totalRounds === 13 && t.g.decks === 1, 'newGame() tanpa argumen: 4 pemain, 13 ronde, 1 dek');
  ok(t.g.players[3].human && !t.g.players[0].human && t.g.players[1].persona === 'bluffer', 'bawaan: 3 bot + manusia di kursi 3');
  ok(G.Game.HUMAN === 3 && G.Game.ROUNDS === 13, 'Game.HUMAN dan Game.ROUNDS tetap diekspor');
  ok(t.g.players.every(function (p) { return p.out === false && p.connected === true; }), 'flag out/connected bawaan');
})();

// --- Validasi pengaturan
(function () {
  function throws(cfg) { try { new G.Game().newGame(cfg); return false; } catch (e) { return true; } }
  ok(throws({ seats: [H()] }), '1 kursi ditolak');
  ok(throws({ seats: [H(), H(), H(), H(), H()] }), '5 kursi ditolak');
  ok(throws({ decks: 4 }) && throws({ decks: 0 }), 'jumlah dek di luar 1..3 ditolak');
})();

// --- 2 pemain
(function () {
  var t = mk({ seats: [H('P'), H('Q')] }, 21, true), g = t.g;
  g.setOn(0, true);
  ok(g.phase === 'pick' && g.accuser === 1 && g.candidates.join() === '0', '2 pemain: 1 ON langsung terkunci, yang OFF menuding');
  ok(g.pressured === false, '2 pemain: bluff tekanan tidak terpicu');
  ok(g.accuse(0, 0) === false && g.accuse(1, 1) === false, 'accuse: bukan penuding / tuding diri sendiri ditolak');
  ok(g.accuse(1, 0) === true && g.phase === 'prove' && g.accused === 0, 'accuse(pid, tid) oleh penuding');
  ok(g.submit(1, [{ t: 'num', v: 1, card: 0 }]).error === 'phase', 'submit dari bukan tertuding ditolak');
  ok(noThrow(function () { return g.submit(0, null).ok; }) === false && g.phase === 'prove', 'submit token rusak ditolak, ronde lanjut');
  timeOut(t);
  ok(g.result.reason === 'timeout' && g.players[0].penalty === 4 && g.players[1].penalty === 0, '2 pemain: waktu bukti habis, tertuding ambil 4');
})();
(function () {
  var t = mk({ seats: [H(), H()] }, 22, true);
  timeOut(t);
  ok(t.g.result.kind === 'pass' && t.g.discard === 4, '2 pemain: tidak ada yang ON, kartu dibuang');
})();
(function () {
  var t = mk({ seats: [H(), H()] }, 23, true), g = t.g;
  g.setOn(0, true); g.accuse(1, 0);
  var toks = null;
  if (g.solution) {
    var used = {};
    toks = G.Parser.tokenize(g.solution.expr).map(function (x) {
      if (x.t !== 'num') return x;
      for (var c = 0; c < 4; c++) if (!used[c] && G.Deck.values(g.cards[c]).indexOf(x.v) >= 0) { used[c] = 1; return { t: 'num', v: x.v, card: c }; }
      return x;
    });
  }
  if (toks) {
    var r = g.submit(0, toks);
    ok(r.ok && r.is24 && g.players[1].penalty === 4, '2 pemain: rumus benar, penuding ambil 4');
  } else ok(true, 'kartu mustahil, lewati');
})();

// --- 3 pemain
(function () {
  var t = mk({ seats: [H(), H(), H()] }, 31, true), g = t.g;
  g.setOn(0, true);
  ok(g.phase === 'observe' && g.pressured === true, '3 pemain: 1 ON 2 OFF belum terkunci, tekanan terpicu');
  g.setOn(1, true);
  ok(g.phase === 'pick' && g.accuser === 2 && sameSet(g.candidates, [0, 1]), '3 pemain: tepat 1 OFF menuding');
})();
(function () {
  var t = mk({ seats: [H(), H(), H()] }, 32, true), g = t.g;
  g.setOn(0, true); timeOut(t);
  ok(g.result.kind === 'split' && g.players[1].penalty === 2 && g.players[2].penalty === 2 && g.result.discarded === 0, '3 pemain: waktu habis, 2 OFF dapat 2');
  var t2 = mk({ seats: [H(), H(), H()] }, 33, true);
  timeOut(t2);
  ok(t2.g.result.kind === 'pass', '3 pemain: tidak ada ON, dibuang');
})();
(function () {
  var t = mk({ seats: [B('x', 'medium'), B('y', 'medium'), H()] }, 34, true), g = t.g;
  g.setOn(2, true);
  ok(g.pressured === true, '3 pemain dengan bot: tekanan di 1 ON 2 OFF');
})();

// --- Semua ON (jalur cadangan: dengan saklar satu per satu, ronde terkunci lebih dulu)
[2, 3, 4].forEach(function (n) {
  var seats = []; for (var i = 0; i < n; i++) seats.push(H());
  var t = mk({ seats: seats }, 40 + n, true), g = t.g;
  g.players.forEach(function (p, i) { p.on = true; p.onOrder = i + 1; });
  g.checkTrigger();
  ok(g.phase === 'pick' && g.accuser === n - 1 && g.candidates.length === n - 1 && g.candidates.indexOf(n - 1) < 0,
    n + ' pemain semua ON: yang ON paling akhir menuding');
});

// --- 4 pemain dengan pid eksplisit
(function () {
  var t = mk({ seats: [H(), H(), H(), H()] }, 44, true), g = t.g;
  g.setOn(0, true); g.setOn(1, true);
  ok(g.phase === 'observe', '4 pemain: 2 ON belum terkunci');
  g.setOn(3, true);
  ok(g.phase === 'pick' && g.accuser === 2, '4 pemain: tepat 1 OFF menuding');
  ok(g.accuse(0, 1) === false && g.accuse(2, 3) === true, '4 pemain: hanya penuding yang boleh menuding');
})();

// --- Bot pengganti di batas ronde
(function () {
  var t = mk({ seats: [B('A'), B('B'), H('X'), H('Y')], leaveMode: 'bot' }, 51, true), g = t.g;
  g.setOn(0, true);
  g.leave(3);
  ok(g.players[3].human === true && g.players[3].connected === false && g.phase === 'observe', 'keluar di tengah ronde: kursi belum diganti');
  timeOut(t);
  ok(g.players[3].penalty === 1, 'yang pergi tetap kena aturan waktu habis');
  timeOut(t); // hasil ronde -> batas ronde
  ok(g.round === 2 && g.players[3].human === false && g.players[3].persona === 'medium', 'bot mengganti di batas ronde');
  ok(g.players[3].penalty === 1 && g.players[3].plan !== null && g.players[3].out === false, 'penalti tetap, bot punya rencana');
})();
(function () {
  var t = mk({ seats: [H(), H(), H()], leaveMode: 'bot' }, 52, true), g = t.g;
  g.setOn(0, true); g.setOn(1, true); g.accuse(2, 0);
  g.leave(0);
  ok(g.players[0].human === true, 'tertuding pergi: tetap manusia, tidak dapat solver');
  timeOut(t);
  ok(g.result.reason === 'timeout' && g.players[0].penalty === 4, 'tertuding pergi: waktu habis, ambil 4');
})();

// --- Lanjut tanpa dia
(function () {
  var t = mk({ seats: [H('P'), H('Q'), H('R')], leaveMode: 'continue' }, 61, true), g = t.g;
  g.leave(2); timeOut(t); timeOut(t);
  ok(g.round === 2 && g.players[2].out === true && g.players.length === 3, 'continue: kursi ditandai out, tidak dihapus');
  ok(g.setOn(2, true) === false, 'pemain out tidak bisa menyalakan saklar');
  g.setOn(0, true);
  ok(g.phase === 'pick' && g.accuser === 1 && g.candidates.join() === '0', 'continue: penuding dihitung dari pemain aktif');
  var st = g.standings();
  ok(st[st.length - 1].id === 2 && st[st.length - 1].tag === 'loser' && st[st.length - 1].out === true, 'standings memuat pemain out sebagai kalah');
  g.accuse(1, 0); timeOut(t);
  g.leave(1); timeOut(t);
  ok(g.phase === 'end' && g.round === 2, 'continue: tinggal 1 pemain aktif, game selesai');
})();
(function () {
  var t = mk({ seats: [H(), H(), H()], leaveMode: 'continue' }, 62, true), g = t.g;
  g.leave(1); timeOut(t); timeOut(t);
  g.setOn(0, true);
  ok(g.phase === 'pick' && g.accuser === 2 && g.candidates.join() === '0', 'continue: 2 aktif, 1 ON langsung terkunci');
  var t2 = mk({ seats: [H(), H(), H()], leaveMode: 'continue' }, 63, true), g2 = t2.g;
  g2.leave(1); timeOut(t2); timeOut(t2);
  timeOut(t2);
  ok(g2.result.kind === 'pass' && g2.players[1].penalty === 0, 'continue: pemain out tidak kena bagi kartu');
})();

// --- Banyak dek + simulasi berbagai ukuran meja
function simulateCfg(seed, cfg) {
  var clock = { now: 0 }, rng = mulberry32(seed);
  var g = new G.Game({ rng: rng, clock: function () { return clock.now; } });
  var byDeck = {};
  g.on(function (type, d, gg) {
    if (type === 'round') (byDeck[gg.deckNo] = byDeck[gg.deckNo] || []).push.apply(byDeck[gg.deckNo], gg.cards.map(function (c) { return c.id; }));
  });
  g.newGame(cfg);
  var steps = 0;
  while (g.phase !== 'end' && steps < 2000000) { clock.now += 100; g.tick(); steps++; }
  return { g: g, byDeck: byDeck, pens: g.players.reduce(function (a, p) { return a + p.penalty; }, 0) };
}
var BOTS4 = [B('A', 'honest'), B('B', 'bluffer'), B('C', 'medium'), B('D', 'medium')];
[1, 2, 3].forEach(function (decks) {
  var r = simulateCfg(70 + decks, { seats: BOTS4, decks: decks });
  ok(r.g.phase === 'end' && r.g.round === 13 * decks && r.g.totalRounds === 13 * decks, decks + ' dek: ' + 13 * decks + ' ronde');
  ok(r.pens + r.g.discard === 52 * decks, decks + ' dek: total kartu ' + 52 * decks);
  var keys = Object.keys(r.byDeck);
  ok(keys.length === decks && keys.every(function (k) { return r.byDeck[k].length === 52 && new Set(r.byDeck[k]).size === 52; }),
    decks + ' dek: tiap dek 52 kartu, tidak ada yang dobel');
});
[2, 3].forEach(function (n) {
  for (var s = 0; s < 10; s++) {
    var r = simulateCfg(100 * n + s, { seats: BOTS4.slice(0, n), decks: 1 + (s % 3) });
    ok(r.g.phase === 'end' && r.pens + r.g.discard === 52 * r.g.decks, n + ' bot, seed ' + s + ': selesai dan kartu pas');
  }
});

// --- snapshotFor: hanya whitelist
(function () {
  var TOP = ['you', 'phase', 'round', 'totalRounds', 'cards', 'deckLeft', 'accuser', 'accused', 'candidates',
    'deadline', 'phaseTotal', 'serverNow', 'result', 'standings', 'players'];
  var PL = ['id', 'name', 'human', 'on', 'penalty', 'out'];
  var FORBID = ['"plan"', '"deck"', '"botPick"', '"onOrder"', '"actions"', '"knows"', '"leaving"', '"connected"'];
  var t = mk({ seats: [B('A', 'bluffer'), B('B', 'honest'), H('X')] }, 81, false), g = t.g;

  function checkSnap(label, allowSolution, allowPersona) {
    var s = g.snapshotFor(2), js = JSON.stringify(s);
    ok(sameSet(Object.keys(s), TOP), label + ': field atas = whitelist');
    ok(s.players.every(function (p) { return sameSet(Object.keys(p), allowPersona ? PL.concat(['persona']) : PL); }), label + ': field pemain = whitelist');
    ok(FORBID.every(function (f) { return js.indexOf(f) < 0; }), label + ': tidak memuat deck/plan/botPick');
    if (!allowSolution) ok(js.indexOf('"solution"') < 0 && js.indexOf('"expr"') < 0, label + ': tidak memuat solusi');
    return s;
  }
  var s1 = checkSnap('observe', false, false);
  ok(s1.standings.length === 0, 'observe: standings kosong sebelum game selesai');
  ok(s1.you === 2 && s1.cards.length === 4 && s1.deckLeft === 48 && s1.totalRounds === 13, 'observe: isi snapshot benar');
  s1.cards[0].rank = 'Z'; s1.players[0].penalty = 99;
  ok(g.cards[0].rank !== 'Z' && g.players[0].penalty !== 99, 'snapshot adalah salinan');

  g.players.forEach(function (p) { if (p.plan) p.plan.actions = []; });
  g.setOn(0, true); g.setOn(1, true);
  checkSnap('pick', false, false);
  g.accuse(2, 0);
  checkSnap('prove', false, false);
  timeOut(t);
  var s4 = checkSnap('result', true, false);
  ok(s4.result && s4.result.hasOwnProperty('solution'), 'result: solusi boleh tampil');
  while (g.phase !== 'end') { t.c.now += 100; g.tick(); }
  var s5 = checkSnap('end', true, true);
  ok(s5.players[0].persona === 'bluffer', 'end: persona dibuka');
  ok(s5.standings.length === 3 && s5.standings.every(function (x) { return sameSet(Object.keys(x), ['id', 'penalty', 'tag', 'out']); }), 'end: standings ada, field terbatas');
  var g0 = new G.Game();
  ok(noThrow(function () { return g0.snapshotFor(0).phase; }) === 'idle', 'snapshot saat idle tidak crash');
})();

console.log(pass + ' lulus, ' + failN + ' gagal');
process.exit(failN ? 1 : 0);
