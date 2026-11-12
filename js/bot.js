/* Otak bot: kapan menyala, kapan bluff, siapa yang dituding. */
(function (G) {
  'use strict';

  // find: peluang benar-benar nemu (kalau ada solusi)
  // bluff: peluang pura-pura nemu
  // retract: peluang mematikan lagi setelah bluff
  // pressure: peluang ikut bluff saat 2 pemain sudah ON
  // speed: rentang detik untuk nemu solusi
  var PERSONAS = {
    honest:  { find: 0.85, bluff: 0.05, retract: 0.00, pressure: 0.10, speed: [10, 32] },
    bluffer: { find: 0.60, bluff: 0.50, retract: 0.35, pressure: 0.60, speed: [6, 28] },
    medium:  { find: 0.70, bluff: 0.20, retract: 0.15, pressure: 0.30, speed: [12, 38] }
  };

  function rand(rng, a, b) { return a + rng() * (b - a); }

  /** Rencana satu ronde. actions: [{at: detik, on: bool}] */
  // Angka waktu di PERSONAS untuk fase 45 detik. obsSec lain = waktu ikut diskala.
  function planRound(persona, solution, rng, obsSec) {
    var P = PERSONAS[persona];
    var T = obsSec || 45, k = T / 45;
    var plan = { knows: false, expr: null, actions: [] };
    if (solution && rng() < P.find) {
      plan.knows = true;
      plan.expr = solution.expr;
      plan.actions.push({ at: rand(rng, P.speed[0] * k, P.speed[1] * k), on: true });
    } else if (rng() < P.bluff) {
      var at = rand(rng, 3 * k, 36 * k);
      plan.actions.push({ at: at, on: true });
      if (rng() < P.retract) plan.actions.push({ at: Math.min(at + rand(rng, 3, 8) * k, T - 2), on: false });
    }
    plan.actions.sort(function (a, b) { return a.at - b.at; });
    return plan;
  }

  /** Saat 2 pemain ON, bot yang belum nemu bisa ikut bluff supaya tidak jadi penuding. */
  function maybePressure(persona, plan, elapsed, rng) {
    if (plan.knows) return;
    var pending = plan.actions.some(function (a) { return !a.done && a.on; });
    if (pending) return;
    if (rng() < PERSONAS[persona].pressure) {
      plan.actions.push({ at: elapsed + rand(rng, 1, 5), on: true });
      plan.actions.sort(function (a, b) { return a.at - b.at; });
    }
  }

  // Bot sedikit lebih curiga pada manusia. Putuskan lagi setelah uji main online.
  var HUMAN_SUSPICION_BONUS = 0.3;
  var EARLY_ON_BONUS = 1.5;

  /** Pilih yang dituding. Yang ON paling cepat lebih dicurigai. */
  function chooseTarget(candidates, rng) {
    var minOrder = Math.min.apply(null, candidates.map(function (p) { return p.onOrder; }));
    var weights = candidates.map(function (p) {
      var w = 1;
      if (p.onOrder === minOrder) w += EARLY_ON_BONUS;
      if (p.human) w += HUMAN_SUSPICION_BONUS;
      return w;
    });
    var total = weights.reduce(function (a, b) { return a + b; }, 0);
    var r = rng() * total;
    for (var i = 0; i < candidates.length; i++) {
      r -= weights[i];
      if (r <= 0) return candidates[i].id;
    }
    return candidates[candidates.length - 1].id;
  }

  G.Bot = { PERSONAS: PERSONAS, HUMAN_SUSPICION_BONUS: HUMAN_SUSPICION_BONUS, planRound: planRound, maybePressure: maybePressure, chooseTarget: chooseTarget };
})(globalThis.G24 = globalThis.G24 || {});
