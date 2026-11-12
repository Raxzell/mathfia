/* Layar: menggambar state game dan menerima klik. */
(function (G) {
  'use strict';
  var I = G.I18n, T = I.t, S = G.Sound, Deck = G.Deck, Parser = G.Parser;
  var HUMAN = G.Game.HUMAN;
  var game = new G.Game();
  var $ = function (id) { return document.getElementById(id); };
  var ui = { calc: [], err: null, lastRound: -1, lastSec: null, bubbleT: {}, log: '', prevPen: [0, 0, 0, 0] };

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function nm(pid) { var p = game.players[pid]; return p.human ? T('you') : p.name; }

  // ---------- wajah noir (topi fedora) ----------
  var HAT = ['#2b2b31', '#3d1517', '#1c2a34', '#0e0e11'];
  var BAND = ['#c9a14a', '#e3342f', '#7fa6bd', '#f2b84b'];
  var SKIN = ['#d9cdb5', '#e2c9b0', '#c8b79c', '#d6c6a8'];
  function avatar(i) {
    return '<svg viewBox="0 0 64 64" aria-hidden="true">' +
      '<path d="M12 64c2-12 9-17 20-17s18 5 20 17z" fill="#24242a"/>' +
      '<path d="M26 47l6 7 6-7z" fill="' + BAND[i] + '" opacity=".8"/>' +
      '<circle cx="32" cy="35" r="13" fill="' + SKIN[i] + '"/>' +
      '<rect x="22" y="31" width="20" height="3" rx="1.5" fill="#000" opacity=".18"/>' +
      '<ellipse class="eye" cx="27" cy="36" rx="2" ry="2.3" fill="#111"/>' +
      '<ellipse class="eye" cx="37" cy="36" rx="2" ry="2.3" fill="#111"/>' +
      '<path d="M28 42.5q4 1.6 8 0" stroke="#111" stroke-width="1.6" fill="none" stroke-linecap="round"/>' +
      '<rect x="7" y="25" width="50" height="4.5" rx="2.2" fill="' + HAT[i] + '"/>' +
      '<path d="M18 26c0-10 5-15 14-15s14 5 14 15z" fill="' + HAT[i] + '"/>' +
      '<path d="M28 13q4 3 8 0" stroke="#000" stroke-width="1.5" fill="none" opacity=".35"/>' +
      '<rect x="18" y="21" width="28" height="3.6" fill="' + BAND[i] + '"/>' +
      '</svg>';
  }

  // ---------- teks tetap ----------
  function applyStatic() {
    document.documentElement.lang = I.lang;
    document.querySelectorAll('[data-i18n]').forEach(function (el) { el.textContent = T(el.getAttribute('data-i18n')); });
    document.querySelectorAll('[data-lang]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-lang') === I.lang)); });
    $('sound').textContent = T(S.muted ? 'soundOff' : 'soundOn');
    document.querySelectorAll('.howtoHtml').forEach(function (el) { el.innerHTML = T('howtoHtml'); });
    renderLineup();
    renderSpeed();
  }

  // ---------- kursi bot ----------
  function buildSeats() {
    var h = '';
    for (var i = 0; i < 3; i++) {
      h += '<div class="seat" id="seat' + i + '">' +
        '<div class="bubble" id="bub' + i + '"></div>' +
        '<div class="ava">' + avatar(i) + '</div>' +
        '<div><div class="name">' + esc(game.players[i].name) + '</div>' +
        '<span class="lamp" id="lamp' + i + '"><i></i><span></span></span></div>' +
        '<div class="pen" id="penw' + i + '"><b id="pen' + i + '">0</b><em data-i18n="penalty">' + T('penalty') + '</em></div>' +
        '<button class="btn danger accuse hidden" id="acc' + i + '" data-pick="' + i + '"></button>' +
        '</div>';
    }
    $('bots').innerHTML = h;
  }

  function bumpPen(el, pid) {
    var p = game.players[pid];
    if (p.penalty > ui.prevPen[pid]) {
      el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
    }
  }

  function renderSeats() {
    var ph = game.phase;
    for (var i = 0; i < 3; i++) {
      var p = game.players[i], cls = 'seat';
      if (p.on) cls += ' on';
      var isCand = ph === 'pick' && game.candidates.indexOf(i) >= 0;
      if (ph === 'pick' && !isCand && game.accuser !== i) cls += ' dim';
      if (isCand && game.accuser === HUMAN) cls += ' cand';
      if ((ph === 'pick' || ph === 'prove') && game.accuser === i) cls += ' accuser';
      if (ph === 'prove' && game.accused === i) cls += ' target';
      var el = $('seat' + i);
      if (el.className !== cls) el.className = cls;
      var lamp = $('lamp' + i);
      lamp.className = 'lamp' + (p.on ? ' on' : '');
      lamp.lastChild.textContent = T(p.on ? 'on' : 'off');
      $('pen' + i).textContent = p.penalty;
      bumpPen($('penw' + i), i);
      var btn = $('acc' + i);
      var showBtn = isCand && game.accuser === HUMAN;
      btn.classList.toggle('hidden', !showBtn);
      if (showBtn) btn.textContent = T('accuseBtn', { n: p.name });
    }
  }

  function bubble(pid, text) {
    if (pid === HUMAN || !text) return;
    var el = $('bub' + pid);
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(ui.bubbleT[pid]);
    ui.bubbleT[pid] = setTimeout(function () { el.classList.remove('show'); }, 2400);
  }

  // ---------- kartu ----------
  function cardFace(c) {
    var s = Deck.SYMBOL[c.suit];
    var val = c.rank === 'A' ? '1 / 11' : (c.rank === 'J' || c.rank === 'Q' || c.rank === 'K') ? '= 10' : '';
    return '<div class="face front' + (Deck.isRed(c) ? ' red' : '') + '">' +
      '<div class="corner"><b>' + c.rank + '</b><span>' + s + '</span></div>' +
      '<div class="pip">' + s + '</div>' +
      '<div class="corner br"><b>' + c.rank + '</b><span>' + s + '</span></div>' +
      (val ? '<div class="val">' + val + '</div>' : '') + '</div>';
  }

  function usedCards() {
    var u = {};
    ui.calc.forEach(function (t) { if (t.t === 'num') u[t.card] = true; });
    return u;
  }
  function humanProving() { return game.phase === 'prove' && game.accused === HUMAN; }

  function renderCards() {
    if (game.round !== ui.lastRound) {
      ui.lastRound = game.round;
      $('cards').innerHTML = game.cards.map(function (c, i) {
        return '<div class="card" id="card' + i + '" data-tap="' + i + '" style="--i:' + i + '" aria-label="' + c.rank + ' ' + c.suit + '">' +
          '<div class="inner"><div class="face back"></div>' + cardFace(c) + '</div></div>';
      }).join('');
      S.deal();
    }
    var u = usedCards(), proving = humanProving();
    game.cards.forEach(function (c, i) {
      var el = $('card' + i);
      el.classList.toggle('used', proving && !!u[i]);
      el.classList.toggle('tap', proving && !u[i] && c.rank !== 'A');
    });
    $('deckInfo').textContent = T('deckLeft', { k: game.deck.length });
  }

  // ---------- panel kamu ----------
  function tokLabel(t) {
    if (t.t === 'num') return String(t.v);
    if (t.t === 'op') return { '+': '+', '-': '−', '*': '×', '/': '÷' }[t.v];
    return t.t;
  }

  function renderCalc() {
    var u = usedCards(), full = Object.keys(u).length === 4;
    var pv = Parser.evaluate(ui.calc), h = '';
    var res = '';
    if (ui.calc.length && pv.ok) {
      var is24 = G.Frac.isInt(pv.value, 24);
      res = '<span class="res' + (full ? (is24 ? ' ok' : ' no') : '') + '">= ' + G.Frac.toString(pv.value) + '</span>';
    }
    h += '<div class="expr" aria-live="polite">' +
      (ui.calc.length ? '<span>' + ui.calc.map(tokLabel).join(' ') + '</span>' : '<span class="ph">' + T('placeholder') + '</span>') +
      res + '</div><div class="keys">';
    game.cards.forEach(function (c, i) {
      var s = Deck.SYMBOL[c.suit], red = Deck.isRed(c) ? ' red' : '', dis = u[i] ? ' disabled' : '';
      if (c.rank === 'A') {
        h += '<button class="key c' + red + '" data-card="' + i + '" data-v="1"' + dis + '>1<small>A' + s + '</small></button>';
        h += '<button class="key c' + red + '" data-card="' + i + '" data-v="11"' + dis + '>11<small>A' + s + '</small></button>';
      } else {
        var v = Deck.values(c)[0];
        h += '<button class="key c' + red + '" data-card="' + i + '" data-v="' + v + '"' + dis + '>' + v + '<small>' + c.rank + s + '</small></button>';
      }
    });
    [['+', '+'], ['-', '−'], ['*', '×'], ['/', '÷'], ['(', '('], [')', ')']].forEach(function (o) {
      h += '<button class="key op" data-op="' + o[0] + '" aria-label="' + o[1] + '">' + o[1] + '</button>';
    });
    h += '</div><div class="act">' +
      '<button class="btn" id="undo">' + T('undo') + '</button>' +
      '<button class="btn" id="clr">' + T('clear') + '</button>' +
      '<button class="btn pri" id="sub"' + (full && pv.ok ? '' : ' disabled') + '>' + T('submit') + '</button></div>' +
      '<div class="err">' + (ui.err ? esc(T('err_' + ui.err)) : '') + '</div>';
    return h;
  }

  function renderMe() {
    var me = game.players[HUMAN], ph = game.phase, h = '';
    var canToggle = ph === 'observe';
    h += '<div class="me-row"><div class="me-id"><div class="ava">' + avatar(3) + '</div><div>' +
      '<div class="name">' + T('you') + '</div>' +
      '<div class="pen" id="penw3"><b>' + me.penalty + '</b><em>' + T('penalty') + '</em></div></div></div>' +
      '<button class="sw' + (me.on ? ' is-on' : '') + '" role="switch" aria-checked="' + me.on + '" id="sw"' + (canToggle ? '' : ' disabled') + '>' +
      '<span class="track"><span class="knob"></span></span>' +
      '<span class="sw-txt"><b>' + T(me.on ? 'meOn' : 'meOff') + '</b><small>' + T(canToggle ? 'meHint' : 'meLocked') + '</small></span></button></div>';
    if (ph === 'pick' && game.accuser === HUMAN) {
      h += '<div class="sub"><b>' + T('pickTitle') + '</b><p>' + T('pickHint') + '</p><div class="pick">' +
        game.candidates.map(function (id) { return '<button class="btn danger" data-pick="' + id + '">' + T('accuseBtn', { n: esc(nm(id)) }) + '</button>'; }).join('') +
        '</div></div>';
    }
    if (humanProving()) h += '<div class="sub">' + renderCalc() + '</div>';
    var el = $('me');
    el.innerHTML = h;
    el.className = 'panel' + (me.on ? ' on' : '') + (humanProving() ? ' hot' : '');
    bumpPen($('penw3'), HUMAN);
  }

  // ---------- pengumuman ----------
  function renderBanner() {
    var b = $('banner'), ph = game.phase, h = '', info = false;
    if (ph === 'pick') {
      if (game.accuser === HUMAN) h = '<b>' + T('pickTitle') + '</b>';
      else { h = '<b>' + T('botPicking', { n: esc(nm(game.accuser)) }) + '</b>'; info = true; }
    } else if (ph === 'prove') {
      if (game.accused === HUMAN) h = '<b>' + T('accusedYou', { a: esc(nm(game.accuser)) }) + '</b><span>' + T('accusedYouHint') + '</span>';
      else h = '<b>' + T('botAccused', { a: esc(nm(game.accuser)), t: esc(nm(game.accused)) }) + '</b><span>' + T('botProving', { t: esc(nm(game.accused)) }) + '</span>';
    }
    b.className = 'banner' + (info ? ' info' : '') + (h ? '' : ' hidden');
    b.innerHTML = h;
  }

  // ---------- hasil ronde ----------
  function renderResult() {
    var box = $('result'), r = game.result;
    if (game.phase !== 'result' || !r) { box.classList.add('hidden'); box.innerHTML = ''; return; }
    var stamp, scls = '', text, big = '';
    if (r.kind === 'proof') {
      var a = esc(nm(r.accuser)), t = esc(nm(r.accused));
      if (r.success) { stamp = 'st_proven'; scls = ' proven'; text = T('resProven', { t: t, a: a }); big = esc(r.expr) + ' = 24'; }
      else if (r.reason === 'wrong') { stamp = 'st_wrong'; text = T('resWrong', { t: t, v: esc(r.value) }); big = esc(r.expr) + ' = ' + esc(r.value); }
      else if (r.reason === 'timeout') { stamp = 'st_timeout'; text = T('resTimeout', { t: t }); }
      else { stamp = 'st_bluff'; text = T('resBluff', { t: t }); }
    } else if (r.kind === 'pass') { stamp = 'st_pass'; scls = ' neutral'; text = T('resPass'); }
    else { stamp = 'st_split'; text = T('resSplit'); }

    var gains = r.gains.map(function (g) { return '<span>' + esc(nm(g.pid)) + ' +' + g.k + '</span>'; });
    if (r.kind === 'split' && r.discarded) gains.push('<span>' + T('discarded', { k: r.discarded }) + '</span>');
    var sol = '';
    if (!(r.kind === 'proof' && r.success)) {
      sol = '<div class="sol">' + (r.solution ? esc(T('solution', { e: Parser.pretty(r.solution.expr) })) : T('impossible')) + '</div>';
    }
    var last = game.round >= G.Game.ROUNDS;
    box.innerHTML = '<div class="file"><div class="stamp' + scls + '">' + T(stamp) + '</div>' +
      (big ? '<div class="expr-big">' + big + '</div>' : '') +
      '<p>' + text + '</p>' + (gains.length ? '<div class="gains">' + gains.join('') + '</div>' : '') + sol +
      '<div class="row"><button class="btn" id="next">' + T(last ? 'finish' : 'next') + '</button><small id="autoNext"></small></div></div>';
    box.classList.remove('hidden');
  }

  // ---------- akhir ----------
  function renderEnd() {
    var end = game.phase === 'end';
    $('game').classList.toggle('hidden', end);
    $('final').classList.toggle('hidden', !end);
    if (!end) return;
    var h = '<tr><th>' + T('player') + '</th><th>' + T('status') + '</th><th style="text-align:right">' + T('pens') + '</th></tr>';
    game.standings().forEach(function (s, i) {
      var p = game.players[s.id];
      h += '<tr class="' + s.tag + '" style="animation-delay:' + (i * 0.12) + 's"><td><span class="who">' + esc(nm(s.id)) + '</span>' +
        (p.persona ? '<small>' + T('persona_' + p.persona) + '</small>' : '') + '</td>' +
        '<td>' + (s.tag ? T(s.tag) : '') + '</td><td class="n">' + s.penalty + '</td></tr>';
    });
    $('board').innerHTML = h;
  }

  // ---------- jam ----------
  function renderTimer() {
    var ph = game.phase, rem = game.remaining(), total = game.phaseTotal || 1;
    var sec = Math.ceil(rem / 1000);
    var botPicking = ph === 'pick' && game.accuser !== HUMAN;
    var timed = ph === 'observe' || ph === 'prove' || (ph === 'pick' && !botPicking);
    $('bar').firstElementChild.style.width = (timed ? (rem / total) * 100 : 0) + '%';
    var warn = (ph === 'observe' || ph === 'prove') && sec <= 10;
    $('bar').className = 'bar' + (warn ? ' warn' : '');
    $('clock').className = 'clock' + (warn ? ' warn' : '');
    $('sec').textContent = timed ? sec : '—';
    var an = $('autoNext');
    if (an) an.textContent = T('auto', { s: sec });
    if (warn && sec <= 5 && sec > 0 && sec !== ui.lastSec) S.tick();
    ui.lastSec = sec;
  }

  function renderMeta() {
    $('rn').textContent = game.round;
    var pl = $('phaseLabel');
    pl.textContent = T('phase_' + game.phase);
    pl.className = 'phase' + (game.phase === 'pick' || game.phase === 'prove' ? ' hot' : '');
    $('log').textContent = ui.log;
  }

  // ---------- menu ----------
  var LINEUP = [['Bot A', 'honest'], ['Bot B', 'bluffer'], ['Bot C', 'medium']];

  // ---------- pilihan waktu mengamati ----------
  var SPEEDS = { relax: 120000, normal: 90000, fast: 45000 };
  var store = (function () { try { return localStorage; } catch (e) { return null; } })();
  var speed = (store && store.getItem('g24_speed')) || 'normal';
  if (!SPEEDS[speed]) speed = 'normal';
  function renderSpeed() {
    var el = $('speed');
    if (!el) return;
    el.innerHTML = '<span class="speed-l">' + T('speedLabel') + '</span>' + Object.keys(SPEEDS).map(function (k) {
      return '<button data-speed="' + k + '" aria-pressed="' + (k === speed) + '">' + T('speed_' + k) +
        '<small>' + (SPEEDS[k] / 1000) + ' ' + T('sec') + '</small></button>';
    }).join('');
    $('factObs').textContent = SPEEDS[speed] / 1000;
  }

  // ---------- logo: topi fedora di atas cap 24 ----------
  var LOGO = '<svg viewBox="0 0 120 132" role="img" aria-label="Mathfia 24">' +
    '<circle cx="60" cy="80" r="44" fill="none" stroke="#e3342f" stroke-width="5"/>' +
    '<circle cx="60" cy="80" r="36.5" fill="none" stroke="#e3342f" stroke-width="1.6"/>' +
    '<text x="60" y="98" text-anchor="middle" font-family="Bebas Neue, Impact, sans-serif" font-size="50" fill="#e3342f">24</text>' +
    '<g transform="rotate(-9 60 40)">' +
    '<ellipse cx="60" cy="42" rx="46" ry="8" fill="#141418" stroke="#f2b84b" stroke-opacity=".6" stroke-width="1.2"/>' +
    '<path d="M34 41C33 22 40 10 50 9C55 8.5 57 13 60 13C63 13 65 8.5 70 9C80 10 87 22 86 41Z" fill="#1d1d23" stroke="#f2b84b" stroke-opacity=".6" stroke-width="1.2"/>' +
    '<path d="M34.6 31H85.4L85.9 38H34.1Z" fill="#f2b84b"/>' +
    '<path d="M44 15C47 12 51 12 54 15" stroke="#fff" stroke-opacity=".25" stroke-width="2" fill="none" stroke-linecap="round"/>' +
    '</g></svg>';
  function renderLineup() {
    var el = $('lineup');
    if (!el) return;
    el.innerHTML = LINEUP.map(function (b, i) {
      return '<div class="suspect" style="--i:' + i + '"><div class="ava">' + avatar(i) + '</div>' +
        '<div class="name">' + b[0] + '</div><small>???</small></div>';
    }).join('') +
      '<div class="suspect you" style="--i:3"><div class="ava">' + avatar(3) + '</div>' +
      '<div class="name">' + T('you') + '</div><small>&nbsp;</small></div>';
  }

  function showMenu(on) {
    $('menu').classList.toggle('hidden', !on);
    $('toMenu').classList.toggle('hidden', on);
    $('restart').classList.toggle('hidden', on);
    if (on) { $('game').classList.add('hidden'); $('final').classList.add('hidden'); }
  }

  function renderAll() {
    showMenu(game.phase === 'idle');
    if (game.phase === 'idle') return;
    renderEnd();
    if (game.phase !== 'end') {
      renderMeta(); renderSeats(); renderCards(); renderMe(); renderBanner(); renderResult(); renderTimer();
    }
    ui.prevPen = game.players.map(function (p) { return p.penalty; });
  }

  // ---------- kejadian dari mesin ----------
  game.on(function (type, d) {
    if (type === 'newgame') { ui.lastRound = -1; ui.prevPen = [0, 0, 0, 0]; }
    if (type === 'round') { ui.calc = []; ui.err = null; ui.log = T('log_start', { r: game.round }); }
    if (type === 'toggle') {
      ui.log = T(d.on ? 'log_on' : 'log_off', { n: nm(d.pid) });
      if (d.pid !== HUMAN) { bubble(d.pid, I.pick(d.on ? 'quip_on' : 'quip_off')); S[d.on ? 'on' : 'off'](); }
    }
    if (type === 'pick') { S.alarm(); if (game.accuser !== HUMAN) bubble(game.accuser, I.pick('quip_think')); }
    if (type === 'prove') {
      ui.calc = []; ui.err = null;
      ui.log = T('botAccused', { a: nm(game.accuser), t: nm(game.accused) });
      bubble(game.accuser, I.pick('quip_accuse'));
      setTimeout(function () { bubble(game.accused, I.pick('quip_accused')); }, 500);
      S.alarm();
    }
    if (type === 'result') {
      var r = game.result;
      S.stamp();
      if (r.kind === 'proof') {
        bubble(r.accused, I.pick(r.success ? 'quip_ok' : 'quip_fail'));
        var humanLost = r.gains.some(function (g) { return g.pid === HUMAN; });
        if (!humanLost && (r.accuser === HUMAN || r.accused === HUMAN)) setTimeout(S.good, 350);
      }
    }
    if (type === 'end') {
      var st = game.standings().filter(function (s) { return s.id === HUMAN; })[0];
      setTimeout(st.tag === 'loser' ? S.lose : S.win, 300);
    }
    if (type === 'change') renderAll();
  });

  // ---------- klik ----------
  function pushCard(i, v) {
    if (usedCards()[i]) return;
    ui.calc.push({ t: 'num', v: v, card: i });
    ui.err = null; S.click(); renderAll();
  }

  document.addEventListener('click', function (e) {
    var tap = e.target.closest('[data-tap]');
    if (tap && humanProving()) {
      var ci = +tap.getAttribute('data-tap'), c = game.cards[ci];
      if (c.rank !== 'A') pushCard(ci, Deck.values(c)[0]);
      return;
    }
    var b = e.target.closest('button');
    if (!b || b.disabled) return;
    if (b.hasAttribute('data-lang')) { I.setLang(b.getAttribute('data-lang')); applyStatic(); renderAll(); return; }
    if (b.id === 'sound') { S.toggle(); applyStatic(); return; }
    if (b.hasAttribute('data-speed')) {
      speed = b.getAttribute('data-speed');
      if (store) store.setItem('g24_speed', speed);
      S.click(); renderSpeed(); return;
    }
    if (b.id === 'start' || b.id === 'restart' || b.id === 'again') { S.click(); game.observeMs = SPEEDS[speed]; game.newGame(); window.scrollTo(0, 0); return; }
    if (b.id === 'toMenu' || b.id === 'backMenu') { S.click(); game.stop(); window.scrollTo(0, 0); return; }
    if (b.id === 'sw') { var me = game.players[HUMAN]; S[me.on ? 'off' : 'on'](); game.setOn(HUMAN, !me.on); return; }
    if (b.id === 'next') { S.click(); game.next(); return; }
    if (b.hasAttribute('data-pick')) { S.click(); game.accuse(+b.getAttribute('data-pick')); return; }
    if (!humanProving()) return;
    if (b.hasAttribute('data-card')) { pushCard(+b.getAttribute('data-card'), +b.getAttribute('data-v')); return; }
    if (b.hasAttribute('data-op')) {
      var o = b.getAttribute('data-op');
      ui.calc.push(o === '(' || o === ')' ? { t: o } : { t: 'op', v: o });
      ui.err = null; S.click(); renderAll(); return;
    }
    if (b.id === 'undo') { ui.calc.pop(); ui.err = null; renderAll(); return; }
    if (b.id === 'clr') { ui.calc = []; ui.err = null; renderAll(); return; }
    if (b.id === 'sub') {
      var r = game.submit(ui.calc);
      if (!r.ok) { ui.err = r.error; renderAll(); }
    }
  });

  // Keyboard: angka/operator saat pembuktian, spasi = saklar
  document.addEventListener('keydown', function (e) {
    if (e.target.tagName === 'INPUT' || e.ctrlKey || e.metaKey || e.altKey) return;
    if (humanProving()) {
      var k = e.key;
      var map = { '+': '+', '-': '-', '*': '*', 'x': '*', '/': '/', '(': '(', ')': ')' };
      if (map[k]) { e.preventDefault(); var o = map[k]; ui.calc.push(o === '(' || o === ')' ? { t: o } : { t: 'op', v: o }); ui.err = null; renderAll(); }
      else if (k === 'Backspace') { e.preventDefault(); ui.calc.pop(); renderAll(); }
      else if (k === 'Enter') { e.preventDefault(); var s = $('sub'); if (s && !s.disabled) s.click(); }
    } else if (e.key === ' ' && game.phase === 'observe' && document.activeElement === document.body) {
      e.preventDefault(); $('sw') && $('sw').click();
    }
  });

  // ---------- mulai ----------
  document.querySelectorAll('.logo').forEach(function (el) { el.innerHTML = LOGO; });
  applyStatic();
  game.players = [{ name: 'Bot A' }, { name: 'Bot B' }, { name: 'Bot C' }, { human: true }];
  buildSeats();
  showMenu(true);
  setInterval(function () {
    if (game.phase === 'idle') return;
    game.tick();
    if (game.phase !== 'end' && game.phase !== 'idle') renderTimer();
  }, 100);

  // untuk uji di konsol
  window.__g24 = game;
})(globalThis.G24 = globalThis.G24 || {});
