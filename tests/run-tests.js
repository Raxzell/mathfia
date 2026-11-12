/* Jalankan: node tests/run-tests.js */
'use strict';
var path = require('path');
['fraction', 'deck', 'solver', 'parser', 'bot', 'game'].forEach(function (f) {
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

console.log(pass + ' lulus, ' + failN + ' gagal');
process.exit(failN ? 1 : 0);
