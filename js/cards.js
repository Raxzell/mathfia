/* Nilai dan tampilan kartu. Dipakai server dan layar. Tidak memuat dek atau pengocok. */
(function (G) {
  'use strict';

  var SYMBOL = { S: '♠', H: '♥', D: '♦', C: '♣' };

  /** Nilai yang boleh dipakai kartu ini. As = 1 atau 11. */
  function values(card) {
    if (card.rank === 'A') return [1, 11];
    if (card.rank === 'J' || card.rank === 'Q' || card.rank === 'K') return [10];
    return [parseInt(card.rank, 10)];
  }

  function isRed(card) { return card.suit === 'H' || card.suit === 'D'; }

  G.Cards = { values: values, isRed: isRed, SYMBOL: SYMBOL };
})(globalThis.G24 = globalThis.G24 || {});
