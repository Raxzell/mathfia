/* Dek 52 kartu, nilai kartu, dan pengocok. */
(function (G) {
  'use strict';

  var SUITS = ['S', 'H', 'D', 'C'];
  var RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  var SYMBOL = { S: '♠', H: '♥', D: '♦', C: '♣' };

  function makeDeck() {
    var deck = [];
    SUITS.forEach(function (s) {
      RANKS.forEach(function (r) { deck.push({ rank: r, suit: s, id: r + s }); });
    });
    return deck;
  }

  /** Nilai yang boleh dipakai kartu ini. As = 1 atau 11. */
  function values(card) {
    if (card.rank === 'A') return [1, 11];
    if (card.rank === 'J' || card.rank === 'Q' || card.rank === 'K') return [10];
    return [parseInt(card.rank, 10)];
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

  function isRed(card) { return card.suit === 'H' || card.suit === 'D'; }

  G.Deck = { makeDeck: makeDeck, values: values, shuffle: shuffle, isRed: isRed, SYMBOL: SYMBOL };
})(globalThis.G24 = globalThis.G24 || {});
