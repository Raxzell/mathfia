/* Suara kecil buatan WebAudio. Tanpa file audio. */
(function (G) {
  'use strict';
  var ctx = null;
  var store = (function () { try { return globalThis.localStorage; } catch (e) { return null; } })();
  var muted = store ? store.getItem('g24_mute') === '1' : false;

  function beep(freq, dur, type, vol, slide, delay) {
    if (muted) return;
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      var t0 = ctx.currentTime + (delay || 0);
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t0);
      if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
      g.gain.setValueAtTime(vol || 0.06, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(ctx.destination);
      o.start(t0); o.stop(t0 + dur + 0.02);
    } catch (e) { /* tanpa suara */ }
  }

  G.Sound = {
    get muted() { return muted; },
    toggle: function () { muted = !muted; if (store) store.setItem('g24_mute', muted ? '1' : '0'); return muted; },
    click: function () { beep(700, 0.05, 'square', 0.03); },
    on: function () { beep(420, 0.14, 'triangle', 0.07, 880); },
    off: function () { beep(520, 0.14, 'triangle', 0.05, 200); },
    tick: function () { beep(1200, 0.04, 'square', 0.025); },
    deal: function () { for (var i = 0; i < 4; i++) beep(260, 0.07, 'sawtooth', 0.025, 120, i * 0.14); },
    alarm: function () { beep(330, 0.18, 'sawtooth', 0.05, 220); beep(330, 0.18, 'sawtooth', 0.05, 220, 0.22); },
    stamp: function () { beep(110, 0.3, 'sawtooth', 0.12, 40); },
    good: function () { beep(523, 0.12, 'triangle', 0.06, 0, 0); beep(784, 0.2, 'triangle', 0.06, 0, 0.12); },
    win: function () { [523, 659, 784, 1046].forEach(function (f, i) { beep(f, 0.22, 'triangle', 0.06, 0, i * 0.13); }); },
    lose: function () { [392, 330, 262].forEach(function (f, i) { beep(f, 0.3, 'sawtooth', 0.05, 0, i * 0.2); }); }
  };
})(globalThis.G24 = globalThis.G24 || {});
