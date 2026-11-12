# Aturan Mathfia

> **Make 24. Trust no one.**

## Inti permainan

- Ada 4 pemain di meja: kamu dan 3 bot.
- Tiap ronde, 4 kartu dibuka di tengah meja.
- Susun rumus yang hasilnya **24**.
- Kamu boleh berbohong bahwa kamu sudah menemukan jawaban.
- Setelah 13 ronde, pemain dengan **kartu penalti paling sedikit menang**.

---

## Kartu

Game memakai 1 dek berisi 52 kartu, tanpa Joker. Dek dikocok sekali di awal game.
Tiap ronde mengambil 4 kartu, jadi 13 ronde menghabiskan seluruh dek. Tidak ada kartu yang keluar dua kali.

| Kartu | Nilai |
|---|---|
| As (A) | 1 **atau** 11, kamu yang pilih |
| 2 – 10 | Sesuai angkanya |
| J, Q, K | 10 |

Kalau ada lebih dari satu As, nilai tiap As boleh dipilih sendiri-sendiri.

---

## Menyusun rumus

- Keempat kartu wajib dipakai, masing-masing **tepat satu kali**.
- Operator yang boleh: `+` `−` `×` `÷` dan kurung `( )`.
- Hasil di tengah hitungan boleh berupa pecahan. Contoh: `8 ÷ (3 − 8 ÷ 3) = 24`.
- Minus di depan angka tidak boleh. Contoh: `−2 + ...` ditolak.
- Kartu tidak boleh digabung jadi satu angka. Contoh: kartu 2 dan 4 tidak boleh jadi 24.

Ada kartu yang memang **mustahil** jadi 24, misalnya 2-2-2-2. Ini terjadi sekitar 1 dari 5 ronde.

---

## Alur satu ronde

### 1. Fase mengamati

Empat kartu dibuka. Lamanya fase ini sesuai pilihan di menu:

| Pilihan | Waktu |
|---|---|
| Santai | 120 detik |
| Normal (bawaan) | 90 detik |
| Cepat | 45 detik |

Tiap pemain punya saklar:

| Saklar | Arti |
|---|---|
| **Bisa jawab** (ON, lampu menyala) | "Aku sudah nemu" |
| **Belum** (OFF) | "Aku belum nemu" |

- Saklar boleh dinyalakan dan dimatikan sesuka hati selama fase ini.
- Menyalakan saklar tidak harus jujur. Itulah bluffing.
- Saklar terkunci setelah fase mengamati selesai.

### 2. Ronde selesai: ada tudingan

| Keadaan | Siapa yang menuding |
|---|---|
| 3 pemain ON, 1 pemain OFF | Pemain yang masih OFF |
| Keempat pemain ON | Pemain yang paling akhir menyala |

Penuding memilih satu pemain yang ON untuk dituding.

- Kalau kamu yang menuding, kamu punya **15 detik** untuk memilih. Kalau tidak memilih, sistem memilih secara acak.
- Kalau bot yang menuding, bot memilih sendiri.

### 3. Ronde selesai: waktu habis

| Keadaan saat waktu habis | Hasil |
|---|---|
| Tidak ada yang ON | 4 kartu dibuang. Tidak ada penalti. |
| 1 pemain ON, 3 pemain OFF | Tiap pemain OFF dapat 1 kartu. 1 kartu dibuang. |
| 2 pemain ON, 2 pemain OFF | Tiap pemain OFF dapat 2 kartu. |

Pemain yang ON aman.

### 4. Fase membuktikan

Pemain yang dituding punya **30 detik** untuk membuktikan rumusnya.

- **Kamu dituding:** ketuk kartu dan operator untuk menyusun rumus, lalu tekan **Kirim rumus**.
  Rumus yang belum lengkap ditolak, dan kamu boleh mencoba lagi selama waktu masih ada.
- **Bot dituding:** bot menunjukkan rumusnya kalau memang sudah nemu. Kalau tadi cuma bluff, bot gagal.

| Hasil | Siapa ambil 4 kartu penalti |
|---|---|
| Rumus benar (= 24) | **Penuding** |
| Rumus salah (≠ 24) | **Yang dituding** |
| Waktu 30 detik habis | **Yang dituding** |

### 5. Hasil ronde

Hasil ronde tampil selama 8 detik, lalu ronde berikutnya mulai sendiri.
Kalau tidak ada yang berhasil membuktikan, game menunjukkan satu contoh solusi. Kalau kartunya mustahil, game juga memberi tahu.

---

## Akhir permainan

Setelah ronde 13, papan skor menampilkan kartu penalti tiap pemain.

| Posisi | Status |
|---|---|
| Penalti paling sedikit | **Pemenang** |
| Penalti paling banyak | **Kalah** |
| Semua penalti sama | **Seri** |

Kalau beberapa pemain sama-sama paling sedikit, semuanya menang. Kalau sama-sama paling banyak, semuanya kalah.

Di papan skor, sifat tiap bot juga dibuka.

---

## Kontrol keyboard

| Tombol | Fungsi |
|---|---|
| `Spasi` | Nyalakan / matikan saklar (fase mengamati) |
| `+` `-` `*` `x` `/` `(` `)` | Tambah operator (fase membuktikan) |
| `Backspace` | Hapus langkah terakhir |
| `Enter` | Kirim rumus |

Kartu tetap harus diketuk atau diklik.

---

## Tips

- Lampu bot yang cepat menyala belum tentu jujur.
- Kalau kartunya terlihat sulit, menyala lebih awal bisa membuatmu aman dari tugas menuding.
- Tapi kalau kamu dituding dan tidak bisa membuktikan, kamu yang kena 4 kartu.
