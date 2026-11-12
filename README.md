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
- Saat 2 pemain sudah menyala, bot yang belum nemu bisa ikut bluff supaya tidak jadi penuding.
- Saat menuding, bot lebih curiga pada pemain yang menyala paling cepat.
- Saat dituding, bot hanya berhasil kalau memang sudah nemu solusi.

Angka ini diatur di `PERSONAS` dalam `js/bot.js`.

---

## Tes

```
node tests/run-tests.js
```

Yang dicek:

- Dek berisi 52 kartu unik, dan nilai kartu benar.
- Parser: urutan hitung, kurung, pecahan, bagi nol, rumus rusak.
- Solver: semua rumus hasilnya benar-benar 24, dan kasus mustahil dikenali.
- 30 simulasi game penuh: selalu 13 ronde, dan total kartu tetap 52.
- Aturan tudingan dan pembagian kartu saat waktu habis.

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
- [ ] Multiplayer online.

---

## Catatan

Nama "Mathfia" masih nama sementara.
