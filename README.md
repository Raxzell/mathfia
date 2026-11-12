# Mathfia

> **Make 24. Trust no one.**

Mathfia adalah game kartu 24 di browser, dengan tambahan bluffing (gertakan).
Empat kartu dibuka. Tiap pemain berusaha menyusun rumus yang hasilnya 24.
Pemain juga boleh pura-pura sudah menemukan jawaban.

Versi ini adalah prototipe **single player**: 1 pemain manusia melawan 3 bot.

Aturan lengkap ada di [RULES.md](RULES.md).

---

## Cara menjalankan

Tidak perlu install apa pun.

1. Buka `index.html` di browser (klik dua kali).
2. Pilih waktu mengamati di menu.
3. Tekan **Mulai main**.

Font diambil dari Google Fonts. Kalau sedang offline, browser memakai font cadangan, dan game tetap jalan.

### Buka di HP

| Cara | Langkah |
|---|---|
| Link online | Seret folder project ke [Netlify Drop](https://app.netlify.com/drop), lalu buka link yang muncul di HP. |
| Wi-Fi yang sama | Jalankan `python -m http.server 8080 --bind 0.0.0.0` di folder project. Buka `http://<IP-laptop>:8080` di HP. Cara ini hanya untuk Wi-Fi rumah. |

---

## Fitur

- 1 dek berisi 52 kartu, dikocok di awal game. Tidak ada kartu yang keluar dua kali.
- 13 ronde, 4 kartu per ronde.
- Saklar "Bisa jawab / Belum" yang bisa dinyalakan dan dimatikan (bluffing).
- 3 bot dengan sifat berbeda.
- Fase penudingan dan pembuktian.
- Penghitung rumus yang aman, tanpa `eval()`.
- Solver 24 bawaan untuk mengecek apakah ada solusi.
- Pilihan waktu mengamati: Santai, Normal, Cepat.
- Bahasa Indonesia / English.
- Efek suara, bisa dimatikan.
- Layar menu, papan skor akhir, dan tombol mulai ulang.

---

## Teknologi

| Bagian | Pakai |
|---|---|
| Tampilan | HTML + CSS biasa |
| Logika | JavaScript biasa (ES5), tanpa framework |
| Build | Tidak ada |
| Suara | Web Audio API, dibuat langsung oleh kode, tanpa file audio |
| Gambar | SVG di dalam kode (logo dan wajah) |
| Font | Bebas Neue, Special Elite, Inter (Google Fonts) |
| Simpan pilihan | `localStorage` |
| Tes | Node.js, tanpa library tambahan |

Tema tampilan: **noir detektif**. Latarnya gelap dengan lampu sorot kuning, cap merah, dan topi fedora.

---

## Struktur folder

```
.
├── index.html           Kerangka halaman
├── style.css            Semua tampilan
├── js/
│   ├── fraction.js      Hitungan pecahan pasti (tanpa pembulatan)
│   ├── deck.js          Dek 52 kartu, nilai kartu, pengocok
│   ├── solver.js        Pencari solusi 24
│   ├── parser.js        Penghitung rumus pemain (aman, tanpa eval)
│   ├── bot.js           Otak bot: kapan menyala, bluff, menuding
│   ├── game.js          Mesin game: fase, timer, penalti, skor
│   ├── i18n.js          Teks Indonesia / English
│   ├── sound.js         Efek suara
│   └── ui.js            Menggambar layar dan menerima klik
├── tests/
│   └── run-tests.js     Tes mesin game
├── README.md
├── RULES.md
└── game24-ui-swiss.html Desain referensi awal (tidak dipakai game)
```

Urutan memuat script di `index.html` penting. Tiap file memakai file sebelumnya.

```
fraction → deck → solver → parser → bot → game → i18n → sound → ui
```

Semua modul ditaruh di satu objek global, `G24` (contoh: `G24.Solver`, `G24.Game`).

---

## Cara kerja mesin

### Alur fase

```
idle (menu)
  → observe   (mengamati, 45 / 90 / 120 detik)
  → pick      (memilih yang dituding)
  → prove     (membuktikan, 30 detik)
  → result    (hasil ronde, 8 detik)
  → observe ... (ronde berikutnya)
  → end       (skor akhir, setelah ronde 13)
```

Kalau waktu mengamati habis tanpa tudingan, game lompat dari `observe` langsung ke `result`.

`game.js` tidak menyentuh layar. Mesin mengirim kejadian (`round`, `toggle`, `pick`, `prove`, `result`, `end`, `change`), lalu `ui.js` menggambar ulang layar.
Setiap 100 ms, `ui.js` memanggil `game.tick()` untuk menjalankan timer dan aksi bot.

### Hitungan pecahan

Semua hitungan memakai pecahan pasti (`fraction.js`), bukan angka desimal.
Jadi `8 ÷ (3 − 8 ÷ 3)` dihitung tepat 24, tanpa salah bulat.

### Penghitung rumus (parser)

Rumus pemain disimpan sebagai daftar token, bukan teks.
Parser membaca token itu dengan aturan urutan hitung biasa: kurung, lalu × ÷, lalu + −.

Rumus ditolak kalau:

| Kode | Arti |
|---|---|
| `cards` | Tidak memakai keempat kartu tepat sekali |
| `value` | Nilai kartu tidak sah (contoh: As bernilai 9) |
| `syntax` | Rumus belum lengkap, kurung tidak pas, atau ada minus di depan angka |
| `div0` | Ada pembagian dengan nol |
| `empty` | Rumus kosong |

### Solver

`solver.js` mencoba semua nilai As (1 dan 11), semua pasangan kartu, dan semua operator.
Hasilnya satu rumus contoh, atau `null` kalau mustahil.

Dari 400 set kartu acak, sekitar **79%** bisa jadi 24. Dalam 13 ronde, biasanya ada 2–3 ronde yang mustahil.

### Bot

| Bot | Sifat | Nemu jawaban | Suka bluff |
|---|---|---|---|
| Bot A | Si jujur | 85% | 5% |
| Bot B | Si penggertak | 60% | 50% |
| Bot C | Si plin-plan | 70% | 20% |

- Di awal ronde, tiap bot membuat rencana: kapan menyala, dan apakah nanti dimatikan lagi.
- Waktu bot ikut diskala dengan pilihan waktu mengamati.
- Saat tinggal tepat 2 pemain aktif yang OFF, bot yang belum nemu bisa ikut bluff supaya tidak jadi penuding (sekali per ronde).
- Saat menuding, bot lebih curiga pada pemain yang menyala paling cepat, dan sedikit lebih curiga pada manusia (`HUMAN_SUSPICION_BONUS = 0.3`).
- Saat dituding, bot hanya berhasil kalau memang sudah nemu solusi.

Angka ini diatur di `PERSONAS` dalam `js/bot.js`.

---

## Server online (Langkah 2)

Server ada di folder `server/`. Isinya 1 room untuk 2 pemain, tanpa bot. Game mulai sendiri saat 2 pemain sudah masuk.

```
cd server
npm install
npm start
```

Lalu buka `http://127.0.0.1:3024` di 2 tab browser. Halaman ini cuma halaman uji polos (`server/dev-client.html`).

Mau dicoba dari HP lewat Wi-Fi rumah? Jalankan `$env:HOST="0.0.0.0"; npm start` di PowerShell. Selama itu jalan, semua perangkat di Wi-Fi yang sama bisa membuka server.

| File | Guna |
|---|---|
| `server/index.js` | HTTP + Socket.IO, `tick()` tiap 100 ms |
| `server/room.js` | Room: join, aksi, cek pengirim, batas laju, kirim snapshot |
| `server/engine.js` | Memuat mesin dari `js/` |
| `server/test/server-test.js` | Tes room dan tes lewat socket sungguhan |

| Pesan klien | Isi |
|---|---|
| `join` | `{ nickname }` |
| `toggle` | `true` / `false` |
| `pick` | id pemain yang dituding |
| `submit` | daftar token rumus |

Server membalas lewat `state` (snapshot), `event`, dan `fail`. Aturan pengamannya:

- Token rumus dibangun ulang di server. Field yang tidak dikenal dibuang, dan jumlah token paling banyak 24.
- Tiap pemain paling banyak mengirim 10 pesan per detik.
- Pemain ketiga, atau yang masuk saat game sudah jalan, ditolak.

Tes server:

```
cd server
npm test
```

---

## Mesin untuk online (Langkah 1)

`game.js` sudah siap dipakai server. Layar online dan server belum ada. Lihat `ONLINE_PLAN.md`.

```js
game.newGame({
  seats: [{ human: true, name: 'Ana' }, { human: false, name: 'Bot A', persona: 'honest' }], // 2..4 kursi
  decks: 2,                // 1..3, total ronde = 13 x dek
  leaveMode: 'bot'         // 'bot' = diganti bot, 'continue' = lanjut tanpa dia
});
```

`newGame()` tanpa argumen tetap membuat game solo: 3 bot + manusia di kursi 3, 1 dek, 13 ronde.

| Fungsi | Guna |
|---|---|
| `setOn(pid, val)` | Saklar. Ditolak untuk pemain yang keluar. |
| `accuse(pid, tid)` | Hanya penuding yang boleh. |
| `submit(pid, tokens)` | Hanya tertuding manusia yang boleh. |
| `setConnected(pid, val)` | Tandai putus / tersambung. |
| `leave(pid)` | Pemain pergi. Diganti di batas ronde, bukan di tengah ronde. |
| `snapshotFor(pid)` | Data aman untuk dikirim ke pemain. |
| `standings()` | Skor akhir. Pemain keluar selalu kalah, di urutan bawah. |

`accuse(tid)` dan `submit(tokens)` dengan satu argumen masih bisa, untuk mode solo. Server online wajib memakai dua argumen.

`snapshotFor` hanya mengirim field di daftar putih. Dek, rencana bot, dan solusi ronde berjalan tidak pernah ikut. Solusi baru muncul di hasil ronde. Sifat bot baru muncul di skor akhir.

`parser.js` menolak token rusak tanpa crash: bukan array, lebih dari 24 token, bentuk token aneh, atau kurung lebih dari 8 lapis.

---

## Tes

```
node tests/run-tests.js
```

Yang dicek:

- Dek berisi 52 kartu unik, dan nilai kartu benar.
- Parser: urutan hitung, kurung, pecahan, bagi nol, rumus rusak, token sembarangan dari jaringan.
- Solver: semua rumus hasilnya benar-benar 24, dan kasus mustahil dikenali.
- 30 simulasi game solo penuh: selalu 13 ronde, dan total kartu tetap 52.
- Aturan tudingan dan pembagian kartu saat waktu habis.
- Meja 2, 3, dan 4 pemain: tepat 1 OFF, semua ON, tidak ada ON, waktu habis.
- Bot pengganti di batas ronde, dan "lanjut tanpa dia".
- 1, 2, 3 dek: jumlah ronde dan kartu pas, tidak ada kartu dobel dalam satu dek.
- `snapshotFor`: hanya field daftar putih di tiap fase.

---

## Pengaturan yang disimpan

Disimpan di `localStorage` browser.

| Kunci | Isi |
|---|---|
| `g24_lang` | `id` atau `en` |
| `g24_mute` | `1` kalau suara mati |
| `g24_speed` | `relax`, `normal`, atau `fast` |

---

## Rencana berikutnya

- [ ] Ganti nama folder project jadi `Mathfia`.
- [ ] Perbaiki tampilan HP:
  - Kertas hasil ronde terpotong di bawah.
  - Kotak rumus saat membuktikan terlalu jauh di bawah.
  - Tombol "Tuding" muncul dua kali.
  - Tombol di atas jadi dua baris.
  - Pilihan waktu di menu tidak rapi.
- [ ] Pilihan baru: hitung mundur baru mulai saat ada pemain yang menyala.
- [ ] Multiplayer online (lihat `ONLINE_PLAN.md`):
  - [x] Langkah 1: mesin game untuk 2–4 kursi, banyak dek, pemain keluar, snapshot.
  - [x] Langkah 2: server minimal.
  - [ ] Langkah 3: layar online, lobby, room, reconnect, emote.

---

## Catatan

Nama "Mathfia" masih nama sementara.
