/* Dek 52 kartu dan pengocok. Hanya server (dan mode solo) yang butuh file ini. Butuh cards.js. */
(function (G) {
  'use strict';

  var SUITS = ['S', 'H', 'D', 'C'];
  var RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

  function makeDeck() {
    var deck = [];
    SUITS.forEach(function (s) {
      RANKS.forEach(function (r) { deck.push({ rank: r, suit: s, id: r + s }); });
    });
    return deck;
  }

  function defaultRng() {
    if (globalThis.crypto && globalThis.crypto.getRandomValues) {
      var a = new Uint32Array(1);
      globalThis.crypto.getRandomValues(a);
      return a[0] / 4294967296;
    }
    return Math.random();
  }

  /** Fisher-Yates. Mengembalikan salinan baru. */
  function shuffle(arr, rng) {
    rng = rng || defaultRng;
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // values, isRed, SYMBOL tetap tersedia di G.Deck supaya kode lama tidak patah.
  G.Deck = {
    makeDeck: makeDeck, shuffle: shuffle,
    values: G.Cards.values, isRed: G.Cards.isRed, SYMBOL: G.Cards.SYMBOL
  };
})(globalThis.G24 = globalThis.G24 || {});
