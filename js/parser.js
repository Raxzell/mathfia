/*
 * Penghitung rumus yang aman (tanpa eval / Function).
 * Token: {t:'num', v:Number, card:Index} | {t:'op', v:'+'|'-'|'*'|'/'} | {t:'('} | {t:')'}
 */
(function (G) {
  'use strict';
  var Fr = G.Frac;

  function fail(code) { var e = new Error(code); e.code = code; return e; }

  // Batas untuk input dari jaringan. Rumus sah 4 kartu jauh di bawah batas ini.
  var MAX_TOKENS = 24, MAX_DEPTH = 8;
  var OPS = { '+': 1, '-': 1, '*': 1, '/': 1 };

  /** Cek bentuk token tanpa melempar error. Mengembalikan kode error atau null. */
  function shapeError(tokens) {
    if (tokens === null || tokens === undefined) return 'empty';
    if (!Array.isArray(tokens)) return 'syntax';
    if (!tokens.length) return 'empty';
    if (tokens.length > MAX_TOKENS) return 'syntax';
    for (var k = 0; k < tokens.length; k++) {
      var tok = tokens[k];
      if (!tok || typeof tok !== 'object') return 'syntax';
      if (tok.t === 'num') {
        if (typeof tok.v !== 'number' || !isFinite(tok.v) || Math.floor(tok.v) !== tok.v) return 'syntax';
      } else if (tok.t === 'op') {
        if (typeof tok.v !== 'string' || !OPS.hasOwnProperty(tok.v)) return 'syntax';
      } else if (tok.t !== '(' && tok.t !== ')') {
        return 'syntax';
      }
    }
    return null;
  }

  function evaluate(tokens) {
    var bad = shapeError(tokens);
    if (bad) return { ok: false, error: bad };
    var i = 0, depth = 0;
    function peek() { return tokens[i]; }
    function isOp(tok, a, b) { return tok && tok.t === 'op' && (tok.v === a || tok.v === b); }

    function expr() {
      var v = term();
      while (isOp(peek(), '+', '-')) {
        var op = tokens[i++].v, r = term();
        v = op === '+' ? Fr.add(v, r) : Fr.sub(v, r);
      }
      return v;
    }
    function term() {
      var v = factor();
      while (isOp(peek(), '*', '/')) {
        var op = tokens[i++].v, r = factor();
        if (op === '*') v = Fr.mul(v, r);
        else { if (r.n === 0) throw fail('div0'); v = Fr.div(v, r); }
      }
      return v;
    }
    function factor() {
      var k = peek();
      if (!k) throw fail('syntax');
      if (k.t === 'num') {
        if (typeof k.v !== 'number' || !isFinite(k.v) || Math.floor(k.v) !== k.v) throw fail('syntax');
        i++; return Fr.F(k.v);
      }
      if (k.t === '(') {
        if (++depth > MAX_DEPTH) throw fail('syntax');
        i++;
        var v = expr();
        if (!peek() || peek().t !== ')') throw fail('syntax');
        i++; depth--; return v;
      }
      throw fail('syntax'); // termasuk minus di depan: tidak diizinkan
    }

    try {
      var v = expr();
      if (i !== tokens.length) throw fail('syntax');
      return { ok: true, value: v };
    } catch (e) {
      if (e && e.code) return { ok: false, error: e.code };
      throw e;
    }
  }

  /** Cek rumus pemain: 4 kartu dipakai tepat sekali, nilai sah, lalu hitung. */
  function check(tokens, cards) {
    var bad = shapeError(tokens);
    if (bad) return { ok: false, error: bad };
    var used = {};
    for (var k = 0; k < tokens.length; k++) {
      var tok = tokens[k];
      if (tok.t !== 'num') continue;
      var c = tok.card;
      if (typeof c !== 'number' || c < 0 || c >= cards.length || used[c]) return { ok: false, error: 'cards' };
      used[c] = true;
      if (G.Cards.values(cards[c]).indexOf(tok.v) < 0) return { ok: false, error: 'value' };
    }
    if (Object.keys(used).length !== cards.length) return { ok: false, error: 'cards' };
    var r = evaluate(tokens);
    if (!r.ok) return r;
    return { ok: true, value: r.value, is24: Fr.isInt(r.value, 24) };
  }

  /** Teks -> token (tanpa info kartu). Dipakai untuk tes dan rumus bot. */
  function tokenize(str) {
    var out = [], s = String(str), i = 0;
    var MAP = { '×': '*', '÷': '/', '−': '-', '+': '+', '-': '-', '*': '*', '/': '/' };
    while (i < s.length) {
      var ch = s[i];
      if (ch === ' ') { i++; continue; }
      if (ch >= '0' && ch <= '9') {
        var j = i; while (j < s.length && s[j] >= '0' && s[j] <= '9') j++;
        out.push({ t: 'num', v: parseInt(s.slice(i, j), 10) }); i = j; continue;
      }
      if (MAP[ch]) { out.push({ t: 'op', v: MAP[ch] }); i++; continue; }
      if (ch === '(' || ch === ')') { out.push({ t: ch }); i++; continue; }
      return null;
    }
    return out;
  }

  var SHOW = { '+': '+', '-': '−', '*': '×', '/': '÷' };
  function toText(tokens) {
    return tokens.map(function (t) {
      if (t.t === 'num') return String(t.v);
      if (t.t === 'op') return SHOW[t.v];
      return t.t;
    }).join(' ').replace(/\( /g, '(').replace(/ \)/g, ')');
  }
  function pretty(expr) {
    return String(expr).replace(/\*/g, '×').replace(/\//g, '÷').replace(/-/g, '−');
  }

  G.Parser = { evaluate: evaluate, check: check, tokenize: tokenize, toText: toText, pretty: pretty };
})(globalThis.G24 = globalThis.G24 || {});
