/* Pencari solusi 24. Mencoba semua nilai As, semua pasangan, semua operator. */
(function (G) {
  'use strict';
  var Fr = G.Frac;

  // p = tingkat ikatan: 3 angka, 2 kali/bagi, 1 tambah/kurang
  function wrap(x, need) { return x.p < need ? '(' + x.e + ')' : x.e; }

  function combos(a, b) {
    var out = [
      { v: Fr.add(a.v, b.v), e: a.e + ' + ' + b.e, p: 1 },
      { v: Fr.mul(a.v, b.v), e: wrap(a, 2) + ' * ' + wrap(b, 2), p: 2 },
      { v: Fr.sub(a.v, b.v), e: a.e + ' - ' + wrap(b, 2), p: 1 },
      { v: Fr.sub(b.v, a.v), e: b.e + ' - ' + wrap(a, 2), p: 1 }
    ];
    if (b.v.n !== 0) out.push({ v: Fr.div(a.v, b.v), e: wrap(a, 2) + ' / ' + wrap(b, 3), p: 2 });
    if (a.v.n !== 0) out.push({ v: Fr.div(b.v, a.v), e: wrap(b, 2) + ' / ' + wrap(a, 3), p: 2 });
    return out;
  }

  function search(items, target) {
    if (items.length === 1) return Fr.isInt(items[0].v, target) ? items[0].e : null;
    for (var i = 0; i < items.length; i++) {
      for (var j = i + 1; j < items.length; j++) {
        var rest = items.filter(function (_, k) { return k !== i && k !== j; });
        var cs = combos(items[i], items[j]);
        for (var c = 0; c < cs.length; c++) {
          var r = search(rest.concat([cs[c]]), target);
          if (r) return r;
        }
      }
    }
    return null;
  }

  function cartesian(lists) {
    return lists.reduce(function (acc, list) {
      var out = [];
      acc.forEach(function (a) { list.forEach(function (x) { out.push(a.concat([x])); }); });
      return out;
    }, [[]]);
  }

  /**
   * @param cards kartu ({rank,suit}) atau daftar nilai ([1,11], [4], ...)
   * @returns {{expr:string, values:number[]}|null}
   */
  function solve(cards, target) {
    target = target || 24;
    var opts = cards.map(function (c) { return Array.isArray(c) ? c : G.Deck.values(c); });
    var all = cartesian(opts);
    for (var i = 0; i < all.length; i++) {
      var items = all[i].map(function (v) { return { v: Fr.F(v), e: String(v), p: 3 }; });
      var e = search(items, target);
      if (e) return { expr: e, values: all[i] };
    }
    return null;
  }

  G.Solver = { solve: solve };
})(globalThis.G24 = globalThis.G24 || {});
