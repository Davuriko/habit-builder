# Habit Builder

Aplikasi pelacak goals & kebiasaan harian. Berjalan di semua perangkat (HP, tablet, laptop) lewat browser, responsif, bisa di-install (PWA), dan jalan offline. Data tersimpan otomatis di perangkat.

## Fitur

- Tambah / hapus habit sendiri
- Centang harian per habit + navigasi antar bulan
- Ringkasan otomatis: progres bulan, hari selesai, streak terpanjang, jumlah habit
- Mode terang & gelap (tombol 🌙 / ☀️)
- Ekspor (⭳) & impor (⭱) data untuk backup / pindah perangkat
- Bisa di-install sebagai aplikasi (PWA) & berjalan offline

## Menjalankan secara lokal

Butuh server lokal (PWA tidak jalan dari `file://`). Dengan Python:

```powershell
cd "path\ke\folder\goals"
python -m http.server 5500
```

Buka di browser: `http://localhost:5500/index.html`
Dari HP di WiFi yang sama: ganti `localhost` dengan IP komputer (cek dengan `ipconfig`), contoh `http://192.168.1.10:5500/index.html`.

## Struktur file

- `index.html` — halaman utama
- `styles.css` — tampilan (terang/gelap, responsif)
- `app.js` — logika tracker, tema, ekspor/impor
- `manifest.json` — metadata PWA
- `service-worker.js` — cache offline
- `icons/` — ikon aplikasi

## Backup data

Data disimpan di browser perangkat. Untuk pindah perangkat: tekan ⭳ untuk mengunduh file backup `.json`, lalu di perangkat baru tekan ⭱ dan pilih file tersebut.
