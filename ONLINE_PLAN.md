# Rencana Mathfia Online

Dokumen ini merangkum keputusan untuk mengubah Mathfia dari single player menjadi online multiplayer. Baca seluruh dokumen sebelum mengubah kode. Kalau ada yang bertentangan dengan kode yang ada, tanyakan dulu, jangan menebak.

Aturan lengkap permainan ada di `RULES.md`. Bagian "Aturan yang berubah" di bawah menimpa `RULES.md` untuk versi online.

---

## 1. Aturan yang berubah

### Pemain dan bot
- Meja berisi 2 sampai 4 kursi. Kursi bisa berisi manusia atau bot.
- Bot opsional. Host memilih jumlah bot saat membuat room. Meja tidak dipaksa penuh 4 kursi.
- Main berdua tanpa bot itu sah. Hasilnya adu cepat menghitung, karena penuding hanya punya satu target.

### Lama game
- Lama game ditentukan **jumlah dek tetap**, dipilih host sebelum mulai (1, 2, atau 3 dek).
- 1 dek = 13 ronde. Total ronde = 13 × jumlah dek.
- Dek dikocok ulang di awal setiap dek. Penalti menumpuk antar dek.
- Pemenang: penalti paling sedikit. Kalah: paling banyak. Aturan seri tetap seperti di `RULES.md`.

### Penentuan penuding (diperbaiki untuk 2 sampai 4 pemain)
- Ronde terkunci begitu **paling banyak 1 pemain aktif yang masih OFF**.
- Kalau tepat 1 yang OFF, dia menuding.
- Kalau semua ON, pemain yang paling akhir menyala menuding.
- Penuding memilih satu pemain ON lain (bukan dirinya) sebagai target.

### Waktu habis
- Tidak ada yang ON: 4 kartu dibuang, tanpa penalti.
- Selain itu: tiap pemain OFF dapat `floor(4 / jumlah OFF)` kartu penalti, sisanya dibuang. Pemain ON aman.
- Dengan aturan penuding di atas, kasus ini hanya terjadi kalau ada 2 atau lebih pemain OFF.

### Pemain keluar atau disconnect
- Pemain yang disconnect punya jendela reconnect 30 sampai 60 detik memakai token yang disimpan di browser.
- Penggantian hanya terjadi **di batas ronde**, tidak pernah di tengah ronde. Di tengah ronde, pemain yang hilang mengikuti aturan waktu habis seperti biasa. Alasannya: kalau bot mengambil alih saat pemain sedang dituding, pemain itu dapat solver gratis.
- Pilihan host per room:
  - **Room dengan bot:** kursi yang ditinggalkan diganti bot (`human = false`, beri `persona`). Penalti yang sudah ada tetap.
  - **Room tanpa bot:** "lanjut tanpa dia". Kursi ditandai `out = true`, penalti tetap tercatat, dihitung kalah di hasil akhir, dan semua hitungan (penuding, waktu habis) memakai pemain aktif saja.
  - Kalau di room tanpa bot tinggal 1 pemain aktif, game selesai.
- Kalau host keluar, hak host pindah ke manusia berikutnya. Room ditutup kalau manusia terakhir pergi.

---

## 2. Room

- Setiap room punya kode pendek (5 karakter, tanpa karakter yang mirip seperti 0/O dan 1/I) dan link `/r/<kode>`.
- **Public:** tampil di daftar room (hanya yang masih menunggu pemain).
- **Private:** tidak tampil di daftar. Masuk lewat kode atau link.
- Tombol **Bagikan** di lobby: `navigator.share` di HP, salin link di desktop.
- Kolom "Masuk pakai kode" di halaman utama.
- Join di tengah game ditolak.
- Identitas awal: nickname tamu, disimpan di `localStorage`. Akun belum ada.
- Beri batas percobaan join per koneksi supaya kode tidak bisa ditebak.
- Satu flag `listed` membedakan public dan private. Opsi "room terkunci" (tampil di daftar, butuh kode) **ditunda**, tapi desain data jangan menghalanginya.

### Opsi host
Kecepatan (waktu mengamati: santai, normal, cepat), jumlah dek, public atau private, jumlah bot, perilaku saat pemain keluar.

### Emote
4 emote, ditampilkan sebagai gelembung kecil di kursi pengirim, jeda sekitar 3 detik per pemain:
😏 (yakin), 🤨 (curiga), 😂 (ngetawain), 👏 (GG).

---

## 3. Arsitektur

### Prinsip
- **Server otoritatif.** Dek, urutan kartu, solver, rencana bot, dan timer hanya ada di server. Klien hanya mengirim aksi dan menggambar layar.
- Yang rahasia adalah **data saat berjalan** (urutan dek, `players[i].plan`, `solution` sebelum ronde selesai), bukan kodenya. Jangan pernah mengirim objek `game` utuh ke klien.
- Server mengirim **snapshot hasil whitelist** per pemain, bukan hasil `JSON.stringify(game)`.

### Pembagian modul

| Modul | Tempat |
|---|---|
| `fraction.js`, `parser.js` | Server dan klien (klien hanya untuk pratinjau, server yang menentukan) |
| `deck.js` | Dipecah: nilai kartu, `SYMBOL`, `isRed` dipakai klien (`cards.js`); `makeDeck` dan `shuffle` server saja |
| `solver.js`, `bot.js`, `game.js` | Server saja |
| `i18n.js`, `sound.js`, `ui.js` | Klien saja |

### Pesan klien ke server
`join(kode, nickname, token)`, `toggle`, `pick(target)`, `submit(tokens)`, `emote(id)`. Khusus host: `start`, `settings`.

### Pesan server ke klien
`state` (snapshot + `serverNow` + `deadline`), `event(type, data)` untuk suara dan gelembung, `error(kode)`.

### Timer
Server menjalankan `tick()`. Klien menerima `deadline` dan `serverNow`, menghitung selisih jam, lalu menghitung mundur hanya untuk tampilan.

### Keamanan input
- Verifikasi pengirim: `accuse` hanya dari penuding, `submit` hanya dari yang dituding, `setOn` hanya untuk kursi milik koneksi itu.
- Sanitasi token rumus dari jaringan: batasi panjang array, batasi bentuk token (`num`, `op`, `(`, `)`), tolak selain itu. Pastikan `parser.js` tahan terhadap input sembarangan.
- Server selalu menghitung ulang rumus. Hasil hitungan klien tidak pernah dipercaya.
- Batasi laju pesan per koneksi.

---

## 4. Perubahan yang dibutuhkan di kode

### `game.js`
1. Hapus `HUMAN = 3` dan daftar pemain tetap di `newGame()`. Ganti dengan daftar kursi dinamis (2 sampai 4) yang berisi manusia dan bot.
2. Ganti `on.length >= 3` di `checkTrigger` dengan kondisi `off.length <= 1` pada pemain aktif (`!p.out`), dan syaratkan minimal 2 pemain aktif.
3. Tambahkan parameter `pid` ke `accuse` dan `submit`, lalu cek bahwa `pid` memang penuding atau yang dituding.
4. Ganti `ROUNDS = 13` dengan `totalRounds = 13 * jumlahDek`, dan kocok ulang dek tiap 13 ronde.
5. Tambahkan flag `out`, `connected`, dan penggantian bot di batas ronde (sebelum `startRound`). Jangan hapus pemain dari array, karena `id` sama dengan indeks. Semua filter pemain aktif (`checkTrigger`, `observeTimeout`, `candidates`) harus mengabaikan `out`. `standings()` tetap memuat pemain `out`.
6. Tambahkan `snapshotFor(pid)` dengan whitelist field (fase, ronde, kartu ronde ini, `deckLeft`, penuding, tertuding, kandidat, `deadline`, `phaseTotal`, `serverNow`, `result`, pemain: `id`, `name`, `human`, `on`, `penalty`, `out`, dan `persona` hanya saat fase `end`).
7. `newGame()`, `stop()`, dan `next()` hanya boleh dipicu host atau server. Putuskan apakah tombol "Lanjut" di layar hasil dipertahankan (ronde sudah lanjut otomatis setelah 8 detik).

### `ui.js`
1. Buat objek tiruan `game` di klien dengan bentuk yang sama dengan sekarang (`phase`, `players`, `cards`, `candidates`, `accuser`, `accused`, `result`, `round`, `remaining()`, `phaseTotal`, `standings()`), diisi dari snapshot server. Metodenya (`setOn`, `accuse`, `submit`) mengirim pesan.
2. Ganti `HUMAN` dengan `game.you`.
3. `buildSeats` dan `renderSeats` jadi dinamis (1 sampai 3 lawan, bukan loop tetap `i < 3`).
4. `game.submit` jadi asinkron. Jalankan `Parser.check` di klien untuk error cepat, kirim ke server, tampilkan balasan lewat callback.
5. Hapus `setInterval(... game.tick() ...)` dan `window.__g24` di build online.
6. Tambahkan lobby, daftar room, tampilan reconnect, dan emote.

### Mode single player
Pertahankan lewat antarmuka tipis `send(aksi)` dan `onState(tampilan)`: online diisi koneksi socket, solo diisi `game.js` lokal. Satu UI untuk keduanya.

---

## 5. Stack

- **Frontend:** tetap HTML, CSS, JS biasa. Tidak pindah ke framework.
- **Backend:** Node.js dengan Socket.IO atau Colyseus (keduanya open source, MIT). Colyseus punya konsep room, daftar room, dan reconnect bawaan.
- **Hosting awal:** frontend statis di Netlify atau Vercel, server game di Render (paket gratis tidur setelah 15 menit idle dan butuh sekitar 30 sampai 50 detik untuk bangun, tampilkan pesan "server sedang bangun"). Cek halaman harga resmi sebelum memutuskan, karena paket gratis sering berubah.
- Vercel tidak cocok untuk server game: dukungan WebSocket-nya masih beta dan koneksi dibatasi durasi.
- Gunakan RNG dengan seed supaya bug online bisa direproduksi.

---

## 6. Ditunda (jangan dikerjakan sekarang)

- Hitung mundur yang baru mulai saat ada pemain ON. Kalau nanti dikerjakan, wajib ada batas atas waktu supaya ronde tidak macet.
- Leaderboard. Alasan: solver 24 online tidak bisa dicegah, dan skor mentah antar jumlah pemain tidak sebanding. Kalau dibuat, pakai poin peringkat per game.
- Akun, karakter custom, add friend.
- Room terkunci (tampil di daftar, butuh kode).

---

## 7. Urutan kerja

**Langkah 1 (tanpa jaringan).** Refactor `game.js` sesuai bagian 4, lalu perluas tes.
- Tes untuk 2, 3, dan 4 pemain, termasuk kasus semua ON, tepat 1 OFF, tidak ada yang ON, dan waktu habis.
- Tes penggantian bot di batas ronde dan "lanjut tanpa dia".
- Tes banyak dek: total kartu tetap sesuai dan tidak ada kartu yang keluar dua kali dalam satu dek.
- Tes bahwa `snapshotFor` tidak memuat `deck`, `solution` (sebelum hasil ronde), dan `plan`.
- Simulasi 30 game penuh tetap lolos.
- `node tests/run-tests.js` harus hijau sebelum lanjut.
- Perbarui `RULES.md` dan `README.md`.

**Langkah 2.** Server minimal: satu room, dua klien, hanya `toggle`, `pick`, `submit`, dengan `tick()` di server.

**Langkah 3.** Objek tiruan `game` di `ui.js`, lalu lobby, daftar room public dan private, tombol Bagikan, reconnect, dan emote.

Satu langkah per sesi. Commit kecil dan sering.

---

## 8. Hal yang belum dicek

`parser.js` dan `bot.js` belum dibaca saat rencana ini dibuat. Sebelum langkah 1, periksa apakah ada asumsi tersembunyi tentang 4 pemain atau tentang `human`, dan apakah parser aman terhadap token sembarangan.
