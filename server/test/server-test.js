/* Jalankan: npm test (di folder server) */
'use strict';
var G = require('../engine');
var roomMod = require('../room');
var Room = roomMod.Room;
var createServer = require('../index').createServer;
var ioc = require('socket.io-client');

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
var FORBID = ['"deck"', '"plan"', '"botPick"', '"actions"', '"onOrder"', '"knows"'];

// ---------------------------------------------------------------
// 1. Room tanpa jaringan: dua pemain palsu main 1 game penuh
// ---------------------------------------------------------------
function fakeMember(log) { return function (ev, data) { log.push({ ev: ev, data: data, json: JSON.stringify(data) }); }; }

(function () {
  var now = 0, rng = mulberry32(5);
  var room = new Room({ G: G, rng: rng, clock: function () { return now; } });
  var la = [], lb = [], lc = [];
  ok(room.join('a', 'Ana', fakeMember(la)).pid === 0, 'room: pemain pertama kursi 0');
  ok(la[la.length - 1].data.phase === 'lobby', 'room: lobby saat baru 1 pemain');
  ok(room.join('a', 'Ana', fakeMember(la)).error === 'joined', 'room: join dua kali ditolak');
  ok(room.join('b', '<b>Budi</b>', fakeMember(lb)).pid === 1, 'room: pemain kedua kursi 1');
  ok(room.game.phase === 'observe' && room.game.players.length === 2, 'room: game mulai otomatis saat 2 pemain');
  ok(room.game.players[1].name === 'bBudi/b', 'room: nama dibersihkan dari < >');
  ok(room.join('c', 'Cici', fakeMember(lc)).error === 'started', 'room: join di tengah game ditolak');

  ok(room.action('c', 'toggle', true).error === 'notjoined', 'room: bukan anggota ditolak');
  ok(room.action('a', 'toggle', 'yes').error === 'bad', 'room: toggle bukan boolean ditolak');
  ok(room.action('a', 'nuke', 1).error === 'bad', 'room: aksi tak dikenal ditolak');

  var rounds = 0, proofs = 0, steps = 0, leak = false, proveRound = 0;
  while (room.game.phase !== 'end' && steps < 400000) {
    var g = room.game;
    if (g.phase === 'observe' && g.round !== rounds) {
      rounds = g.round;
      if (rng() < 0.75) room.action(rng() < 0.5 ? 'a' : 'b', 'toggle', true);
    }
    if (g.phase === 'pick') {
      var accId = g.accuser === 0 ? 'a' : 'b', other = g.accuser === 0 ? 'b' : 'a';
      ok(room.action(other, 'pick', g.accuser).ok === false, 'room: bukan penuding tidak bisa menuding');
      room.action(accId, 'pick', g.candidates[0]);
    }
    if (g.phase === 'prove' && g.round !== proveRound) {
      proveRound = g.round; // sekali per ronde, supaya tidak kena batas laju
      var accused = g.accused === 0 ? 'a' : 'b', notAcc = g.accused === 0 ? 'b' : 'a';
      ok(room.action(notAcc, 'submit', [{ t: 'num', v: 1, card: 0 }]).error === 'phase', 'room: bukan tertuding tidak bisa kirim rumus');
      ok(room.action(accused, 'submit', [null]).error === 'syntax', 'room: token rusak ditolak');
      if (g.solution) {
        var used = {};
        var toks = G.Parser.tokenize(g.solution.expr).map(function (x) {
          if (x.t !== 'num') return x;
          for (var c = 0; c < 4; c++) if (!used[c] && G.Deck.values(g.cards[c]).indexOf(x.v) >= 0) { used[c] = 1; return { t: 'num', v: x.v, card: c }; }
          return x;
        });
        var r = room.action(accused, 'submit', toks);
        ok(r.ok && r.is24, 'room: solusi solver diterima = 24');
        proofs++;
      }
    }
    now += 100; room.tick(); steps++;
  }
  ok(room.game.phase === 'end' && room.game.round === 13, 'room: game penuh 13 ronde selesai');
  var pens = room.game.players.reduce(function (s, p) { return s + p.penalty; }, 0);
  ok(pens + room.game.discard === 52, 'room: total kartu 52');
  ok(proofs > 0, 'room: ada pembuktian yang berhasil');
  la.concat(lb).forEach(function (m) {
    if (m.ev === 'state' && FORBID.some(function (f) { return m.json.indexOf(f) >= 0; })) leak = true;
  });
  ok(!leak, 'room: pesan state tidak memuat deck/plan/botPick');
  var lastA = la.filter(function (m) { return m.ev === 'state'; }).pop();
  ok(lastA.data.phase === 'end' && lastA.data.you === 0, 'room: pemain menerima state akhir');
  ok(room.seats.length === 0 && room.join('c', 'Cici', fakeMember(lc)).ok, 'room: setelah selesai, room menerima pemain baru');
})();

// --- Batas laju
(function () {
  var now = 0;
  var room = new Room({ G: G, rng: mulberry32(9), clock: function () { return now; } });
  room.join('a', 'A', function () {}); room.join('b', 'B', function () {});
  var rate = 0;
  for (var i = 0; i < 20; i++) if (room.action('a', 'pick', 9).error === 'rate') rate++;
  ok(rate === 10, 'room: lebih dari 10 pesan per detik ditolak');
  now += 1001;
  ok(room.action('a', 'pick', 9).error !== 'rate', 'room: batas laju pulih setelah 1 detik');
})();

// --- Putus koneksi
(function () {
  var now = 0;
  var room = new Room({ G: G, rng: mulberry32(10), clock: function () { return now; } });
  room.join('a', 'A', function () {});
  room.leave('a');
  ok(room.seats.length === 0, 'room: keluar dari lobby mengosongkan kursi');
  room.join('a', 'A', function () {}); room.join('b', 'B', function () {});
  room.leave('b');
  ok(room.game.players[1].connected === false && room.game.phase === 'observe', 'room: putus di tengah game ditandai, game lanjut');
  room.leave('a');
  ok(room.game.phase === 'idle' && room.seats.length === 0, 'room: semua putus, room direset');
})();

// --- cleanTokens
(function () {
  var ct = roomMod.cleanTokens;
  ok(ct(null) === null && ct('x') === null && ct([]) === null, 'cleanTokens: bukan array / kosong ditolak');
  var long = []; for (var i = 0; i < 25; i++) long.push({ t: '(' });
  ok(ct(long) === null, 'cleanTokens: lebih dari 24 ditolak');
  ok(ct([{ t: 'num', v: 1.5, card: 0 }]) === null && ct([{ t: 'num', v: 1, card: '0' }]) === null, 'cleanTokens: angka aneh ditolak');
  var c = ct([{ t: 'num', v: 3, card: 1, evil: 'x' }, { t: 'op', v: '+', __proto__: { z: 1 } }]);
  ok(c && Object.keys(c[0]).join() === 't,v,card' && Object.keys(c[1]).join() === 't,v', 'cleanTokens: field asing dibuang');
})();

// ---------------------------------------------------------------
// 2. Lewat Socket.IO sungguhan (127.0.0.1, port acak)
// ---------------------------------------------------------------
function connect(url) {
  return new Promise(function (res) {
    var s = ioc(url, { transports: ['websocket'], forceNew: true, reconnection: false });
    s.states = [];
    s.on('state', function (st) { s.states.push(st); });
    s.on('connect', function () { res(s); });
  });
}
function call(s, ev, data) { return new Promise(function (res) { s.emit(ev, data, res); }); }
function waitFor(fn, ms) {
  return new Promise(function (res, rej) {
    var t0 = Date.now();
    (function loop() { if (fn()) return res(); if (Date.now() - t0 > (ms || 3000)) return rej(new Error('timeout')); setTimeout(loop, 20); })();
  });
}
function last(s) { return s.states[s.states.length - 1]; }

async function socketTest() {
  var srv = createServer({ rng: mulberry32(3) });
  await new Promise(function (r) { srv.listen(0, '127.0.0.1', r); });
  var addr = srv.httpServer.address();
  ok(addr.address === '127.0.0.1', 'socket: server terikat ke 127.0.0.1');
  var url = 'http://127.0.0.1:' + addr.port;
  var a, b, c;
  try {
    // --- file statis: hanya daftar putih
    function get(p) {
      return new Promise(function (res) {
        require('http').get(url + p, function (r) {
          var chunks = []; r.on('data', function (d) { chunks.push(d); });
          r.on('end', function () { res({ code: r.statusCode, type: r.headers['content-type'], body: Buffer.concat(chunks).toString() }); });
        });
      });
    }
    var home = await get('/');
    ok(home.code === 200 && /text\/html/.test(home.type) && home.body.indexOf('Mathfia') >= 0, 'static: / = index.html');
    ok((await get('/js/net.js')).code === 200 && /javascript/.test((await get('/js/ui.js')).type), 'static: file js ada');
    ok((await get('/style.css')).code === 200, 'static: style.css ada');
    ok((await get('/dev')).body.indexOf('dev client') >= 0, 'static: /dev = halaman uji');
    var blocked = ['/server/room.js', '/server/package.json', '/README.md', '/ONLINE_PLAN.md', '/.git/config', '/../package.json',
      '/js/../server/index.js', '/%2e%2e/README.md', '/js/', '/js/nope.js', '/constructor', '/__proto__'];
    for (var bi = 0; bi < blocked.length; bi++) {
      var br = await get(blocked[bi]);
      ok(br.code === 404, 'static: ' + blocked[bi] + ' ditolak');
    }

    a = await connect(url); b = await connect(url);
    ok((await call(a, 'join', { nickname: 'Ana' })).pid === 0, 'socket: Ana join');
    ok((await call(b, 'join', { nickname: 'Budi' })).pid === 1, 'socket: Budi join');
    await waitFor(function () { return last(a) && last(a).phase === 'observe' && last(b) && last(b).phase === 'observe'; });
    ok(last(a).you === 0 && last(b).you === 1 && last(a).cards.length === 4, 'socket: tiap pemain dapat snapshot sendiri');

    c = await connect(url);
    ok((await call(c, 'join', { nickname: 'Cici' })).error === 'started', 'socket: pemain ketiga ditolak');

    ok((await call(a, 'toggle', true)).ok === true, 'socket: Ana ON');
    await waitFor(function () { return last(b).phase === 'pick'; });
    ok(last(b).accuser === 1 && last(b).candidates.join() === '0', 'socket: Budi jadi penuding');
    ok((await call(a, 'pick', 0)).ok === false, 'socket: Ana tidak bisa menuding');
    ok((await call(b, 'pick', 0)).ok === true, 'socket: Budi menuding Ana');
    await waitFor(function () { return last(a).phase === 'prove'; });
    ok((await call(b, 'submit', [{ t: 'num', v: 1, card: 0 }])).error === 'phase', 'socket: Budi tidak bisa kirim rumus');
    ok((await call(a, 'submit', 'DROP TABLE')).error === 'syntax', 'socket: rumus sampah ditolak');
    var cards = last(a).cards;
    var bad = cards.map(function (cd, i) { return { t: 'num', v: G.Deck.values(cd)[0], card: i }; });
    var toks = [bad[0], { t: 'op', v: '+' }, bad[1], { t: 'op', v: '+' }, bad[2], { t: 'op', v: '+' }, bad[3]];
    var sr = await call(a, 'submit', toks);
    ok(sr.ok === true && typeof sr.is24 === 'boolean', 'socket: rumus sah diterima server');
    await waitFor(function () { return last(a).phase === 'result' && last(b).phase === 'result'; });
    ok(last(a).result && last(a).result.kind === 'proof', 'socket: hasil ronde terkirim');
    var all = a.states.concat(b.states).map(function (x) { return JSON.stringify(x); });
    ok(all.every(function (j) { return FORBID.every(function (f) { return j.indexOf(f) < 0; }); }), 'socket: tidak ada deck/plan yang bocor');

    b.disconnect();
    await waitFor(function () { return srv.room.game.players[1].connected === false; });
    ok(srv.room.game.phase !== 'idle', 'socket: Budi putus, game tetap jalan');
  } finally {
    [a, b, c].forEach(function (s) { if (s) s.disconnect(); });
    await new Promise(function (r) { srv.close(r); });
  }
}

socketTest().catch(function (e) { failN++; console.log('FAIL: socket test error', e && e.message); })
  .then(function () {
    console.log(pass + ' lulus, ' + failN + ' gagal');
    process.exit(failN ? 1 : 0);
  });
