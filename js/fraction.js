/* Pecahan pasti (tanpa pembulatan) untuk hitung 24. */
(function (G) {
  'use strict';

  function gcd(a, b) {
    a = Math.abs(a); b = Math.abs(b);
    while (b) { var t = a % b; a = b; b = t; }
    return a || 1;
  }

  function F(n, d) {
    if (d === undefined) d = 1;
    if (d === 0) { var e = new Error('div0'); e.code = 'div0'; throw e; }
    if (d < 0) { n = -n; d = -d; }
    var g = gcd(n, d);
    return { n: n / g, d: d / g };
  }

  function add(a, b) { return F(a.n * b.d + b.n * a.d, a.d * b.d); }
  function sub(a, b) { return F(a.n * b.d - b.n * a.d, a.d * b.d); }
  function mul(a, b) { return F(a.n * b.n, a.d * b.d); }
  function div(a, b) { return F(a.n * b.d, a.d * b.n); } // melempar 'div0' jika b = 0
  function isInt(a, k) { return a.d === 1 && a.n === k; }
  function toString(a) { return a.d === 1 ? String(a.n) : a.n + '/' + a.d; }

  G.Frac = { F: F, add: add, sub: sub, mul: mul, div: div, isInt: isInt, toString: toString };
})(globalThis.G24 = globalThis.G24 || {});
