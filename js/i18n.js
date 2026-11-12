/* Teks Indonesia / English. */
(function (G) {
  'use strict';

  var D = {
    id: {
      subtitle: 'Make 24. Trust no one.', round: 'Ronde', restart: 'Mulai ulang', soundOn: 'Suara: nyala', soundOff: 'Suara: mati',
      phase_observe: 'Pengamatan', phase_pick: 'Penudingan', phase_prove: 'Pembuktian', phase_result: 'Hasil ronde', phase_end: 'Kasus ditutup',
      on: 'Bisa jawab', off: 'Belum',
      meOn: 'Saya bisa jawab', meOff: 'Saya belum nemu', meHint: 'Bisa diubah kapan saja. Lawan melihat lampumu.',
      meLocked: 'Saklar terkunci sampai ronde berikutnya.',
      penalty: 'kartu penalti', you: 'Kamu',
      pickTitle: 'Kamu yang terakhir belum menyala. Tuding satu pemain.',
      pickHint: 'Kalau dia bisa membuktikan, kamu ambil 4 kartu. Kalau gagal, dia yang ambil.',
      accuseBtn: 'Tuding {n}',
      botPicking: '{n} jadi yang terakhir. Dia sedang memilih...',
      accusedYou: '{a} menudingmu!', accusedYouHint: 'Susun rumus = 24 pakai keempat kartu.',
      botAccused: '{a} menuding {t}', botProving: '{t} sedang menyusun rumus...',
      placeholder: 'Ketuk kartu dan operator',
      undo: 'Hapus', clear: 'Kosongkan', submit: 'Kirim rumus',
      st_proven: 'Terbukti', st_bluff: 'Bluff!', st_wrong: 'Salah!', st_timeout: 'Waktu habis', st_pass: 'Semua pas', st_split: 'Waktu habis',
      resProven: '{t} membuktikan rumusnya. {a} ambil 4 kartu.',
      resBluff: '{t} tidak bisa membuktikan. {t} ambil 4 kartu.',
      resWrong: 'Rumus {t} = {v}, bukan 24. {t} ambil 4 kartu.',
      resTimeout: '{t} kehabisan waktu. {t} ambil 4 kartu.',
      resPass: 'Tidak ada yang menyala. 4 kartu dibuang.',
      resSplit: 'Waktu habis. Kartu dibagi ke yang belum menyala.',
      discarded: '{k} dibuang',
      solution: 'Salah satu solusi: {e}', impossible: 'Kartu ini memang mustahil jadi 24.',
      next: 'Ronde berikutnya', finish: 'Lihat hasil akhir', auto: 'otomatis {s} dtk',
      endTitle: 'Kasus ditutup', endSub: 'Kartu penalti paling sedikit menang.',
      player: 'Pemain', status: 'Status', pens: 'Penalti', winner: 'Pemenang', loser: 'Kalah', draw: 'Seri',
      playAgain: 'Main lagi',
      persona_honest: 'si jujur', persona_bluffer: 'si penggertak', persona_medium: 'si plin-plan',
      err_cards: 'Pakai keempat kartu tepat satu kali.', err_syntax: 'Rumus belum lengkap.', err_div0: 'Tidak bisa dibagi nol.', err_empty: 'Rumus masih kosong.', err_value: 'Nilai kartu tidak sah.',
      log_on: '{n} menyalakan lampu.', log_off: '{n} mematikan lampu.', log_start: 'Ronde {r}. Cari 24!',
      deckLeft: '{k} kartu tersisa di dek',
      howto: 'Cara main',
      menu: 'Menu', start: 'Mulai main',
      orOnline: 'atau lawan teman', online: 'Main online', nickPh: 'Nama panggilanmu',
      onlineConnecting: 'Menyambung ke server...',
      onlineNoServer: 'Server tidak ketemu. Jalankan server dulu, lalu buka lewat alamatnya.',
      onlineFile: 'Main online tidak jalan dari file. Jalankan server, lalu buka http://127.0.0.1:3024',
      join_full: 'Meja sudah penuh.', join_started: 'Game sudah mulai. Coba lagi nanti.', join_failed: 'Gagal masuk. Coba lagi.',
      lostServer: 'Koneksi ke server putus.',
      lobbyTitle: 'Menunggu lawan', lobbyWait: '{k} dari {n} pemain sudah masuk', cancel: 'Batal',
      err_phase: 'Belum waktunya.', err_rate: 'Terlalu cepat. Tunggu sebentar.', err_bad: 'Pesan tidak sah.', err_server: 'Server bermasalah.', err_notjoined: 'Kamu belum masuk meja.',
      menuTitle: 'Siapa yang bohong?', menuTag: 'Cari 24 dari empat kartu. Atau pura-pura sudah nemu.',
      speedLabel: 'Waktu mengamati', speed_relax: 'Santai', speed_normal: 'Normal', speed_fast: 'Cepat', sec: 'dtk',
      factRounds: 'ronde', factObserve: 'detik mengamati', factProve: 'detik membuktikan',
      howtoHtml: '<ol><li>Empat kartu dibuka. Cari rumus = 24. Pakai semua kartu, masing-masing sekali.</li><li>As = 1 atau 11. J, Q, K = 10. Boleh + − × ÷ dan kurung.</li><li>Nyalakan saklar kalau bisa. Boleh juga pura-pura (bluff).</li><li>Tiga menyala, satu belum? Yang belum harus menuding satu orang.</li><li>Yang dituding punya 30 detik untuk membuktikan. Benar: penuding ambil 4 kartu. Salah: yang dituding ambil.</li><li>Waktu habis: tidak ada yang menyala, kartu dibuang. Ada yang menyala, kartu dibagi ke yang belum.</li><li>Setelah 13 ronde, penalti paling sedikit menang.</li></ol>',
      quip_on: ['Ketemu.', 'Gampang.', 'Aku tahu.', 'Siap.', 'Hehe.'],
      quip_off: ['Eh, tunggu...', 'Salah hitung.', 'Hmm, nggak jadi.'],
      quip_think: ['Siapa ya...', 'Hmm...', 'Ada yang bohong.'],
      quip_accuse: ['Kamu bohong!', 'Buktikan!', 'Ayo tunjukkan.'],
      quip_accused: ['Aku?!', 'Oke, lihat ini.', 'Serius?'],
      quip_ok: ['Lihat ini.', 'Sudah kubilang.', 'Mudah.'],
      quip_fail: ['Eh... lupa.', 'Tadi ada kok...', 'Ketahuan deh.']
    },
    en: {
      subtitle: 'Make 24. Trust no one.', round: 'Round', restart: 'Restart', soundOn: 'Sound: on', soundOff: 'Sound: off',
      phase_observe: 'Observation', phase_pick: 'Accusation', phase_prove: 'Showdown', phase_result: 'Round result', phase_end: 'Case closed',
      on: 'Can answer', off: 'Not yet',
      meOn: 'I can answer', meOff: 'Not found yet', meHint: 'Change it any time. Rivals can see your lamp.',
      meLocked: 'Switch locked until next round.',
      penalty: 'penalty cards', you: 'You',
      pickTitle: 'You are the last one off. Accuse a player.',
      pickHint: 'If they prove it, you take 4 cards. If they fail, they take them.',
      accuseBtn: 'Accuse {n}',
      botPicking: '{n} is the last one. Choosing a target...',
      accusedYou: '{a} accuses you!', accusedYouHint: 'Build a formula = 24 using all four cards.',
      botAccused: '{a} accuses {t}', botProving: '{t} is building a formula...',
      placeholder: 'Tap cards and operators',
      undo: 'Undo', clear: 'Clear', submit: 'Submit',
      st_proven: 'Proven', st_bluff: 'Bluff!', st_wrong: 'Wrong!', st_timeout: 'Time up', st_pass: 'All pass', st_split: 'Time up',
      resProven: '{t} proved it. {a} takes 4 cards.',
      resBluff: '{t} could not prove it. {t} takes 4 cards.',
      resWrong: '{t} got {v}, not 24. {t} takes 4 cards.',
      resTimeout: '{t} ran out of time. {t} takes 4 cards.',
      resPass: 'Nobody switched on. 4 cards discarded.',
      resSplit: 'Time up. Cards split among those still off.',
      discarded: '{k} discarded',
      solution: 'One solution: {e}', impossible: 'These cards cannot make 24.',
      next: 'Next round', finish: 'See final result', auto: 'auto in {s}s',
      endTitle: 'Case closed', endSub: 'Fewest penalty cards wins.',
      player: 'Player', status: 'Status', pens: 'Penalty', winner: 'Winner', loser: 'Loser', draw: 'Draw',
      playAgain: 'Play again',
      persona_honest: 'the honest one', persona_bluffer: 'the bluffer', persona_medium: 'the wobbly one',
      err_cards: 'Use all four cards exactly once.', err_syntax: 'Formula is not complete.', err_div0: 'Cannot divide by zero.', err_empty: 'Formula is empty.', err_value: 'Invalid card value.',
      log_on: '{n} switched on.', log_off: '{n} switched off.', log_start: 'Round {r}. Find 24!',
      deckLeft: '{k} cards left in deck',
      howto: 'How to play',
      menu: 'Menu', start: 'Start game',
      orOnline: 'or play a friend', online: 'Play online', nickPh: 'Your nickname',
      onlineConnecting: 'Connecting to the server...',
      onlineNoServer: 'Server not found. Start the server first, then open its address.',
      onlineFile: 'Online play does not work from a file. Start the server, then open http://127.0.0.1:3024',
      join_full: 'The table is full.', join_started: 'The game has started. Try again later.', join_failed: 'Could not join. Try again.',
      lostServer: 'Lost connection to the server.',
      lobbyTitle: 'Waiting for opponent', lobbyWait: '{k} of {n} players joined', cancel: 'Cancel',
      err_phase: 'Not yet.', err_rate: 'Too fast. Wait a moment.', err_bad: 'Invalid message.', err_server: 'Server error.', err_notjoined: 'You have not joined the table.',
      menuTitle: 'Who is lying?', menuTag: 'Make 24 from four cards. Or pretend you already did.',
      speedLabel: 'Look time', speed_relax: 'Relaxed', speed_normal: 'Normal', speed_fast: 'Fast', sec: 's',
      factRounds: 'rounds', factObserve: 'seconds to look', factProve: 'seconds to prove',
      howtoHtml: '<ol><li>Four cards are dealt. Make 24 using every card exactly once.</li><li>Ace = 1 or 11. J, Q, K = 10. Use + − × ÷ and brackets.</li><li>Switch on if you can. You may also bluff.</li><li>Three on, one off? The last one off must accuse someone.</li><li>The accused has 30 seconds to prove it. Right: accuser takes 4 cards. Wrong: accused takes them.</li><li>Time up: nobody on, cards discarded. Someone on, cards split among those still off.</li><li>After 13 rounds, fewest penalty cards wins.</li></ol>',
      quip_on: ['Got it.', 'Easy.', 'I know.', 'Ready.', 'Heh.'],
      quip_off: ['Wait...', 'Miscounted.', 'Never mind.'],
      quip_think: ['Who is it...', 'Hmm...', 'Someone is lying.'],
      quip_accuse: ['You are lying!', 'Prove it!', 'Show me.'],
      quip_accused: ['Me?!', 'Fine, watch.', 'Seriously?'],
      quip_ok: ['Watch this.', 'Told you.', 'Easy.'],
      quip_fail: ['Uh... forgot.', 'It was there...', 'Busted.']
    }
  };

  var store = (function () { try { return globalThis.localStorage; } catch (e) { return null; } })();
  var lang = (store && store.getItem('g24_lang')) || 'id';
  if (!D[lang]) lang = 'id';

  function t(key, vars) {
    var s = D[lang][key];
    if (s === undefined) s = D.id[key];
    if (s === undefined) return key;
    if (vars) s = String(s).replace(/\{(\w+)\}/g, function (_, k) { return vars[k] !== undefined ? vars[k] : ''; });
    return s;
  }
  function pick(key, rng) { var a = D[lang][key] || []; return a[Math.floor((rng || Math.random)() * a.length)] || ''; }

  G.I18n = {
    t: t, pick: pick,
    get lang() { return lang; },
    setLang: function (l) { if (D[l]) { lang = l; if (store) store.setItem('g24_lang', l); } }
  };
})(globalThis.G24 = globalThis.G24 || {});
