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

## Deploy gratis ke link online

### Opsi A — Netlify Drop (paling mudah, tanpa setup)

1. Buka https://app.netlify.com/drop
2. Seret seluruh folder `goals` ke halaman tersebut.
3. Tunggu beberapa detik — Netlify memberi link publik (mis. `https://nama-acak.netlify.app`).
4. Buka link itu dari perangkat mana pun, lalu pilih "Add to Home Screen" untuk meng-install.

> Login (gratis) hanya diperlukan jika ingin menyimpan situs secara permanen / mengganti namanya.

### Opsi B — GitHub Pages

1. Buat repo baru di GitHub, mis. `habit-builder`.
2. Unggah semua file di folder ini ke repo (root repo).
3. Repo → **Settings** → **Pages** → Source: `Deploy from a branch`, Branch: `main` / `/root` → Save.
4. Tunggu ~1 menit, link muncul: `https://USERNAME.github.io/habit-builder/`.

### Opsi C — Vercel

1. Buka https://vercel.com → New Project → import folder/repo ini.
2. Framework preset: **Other** (situs statis). Deploy.

Semua file bersifat statis (HTML/CSS/JS), jadi tidak perlu build step.

## Struktur file

- `index.html` — halaman utama
- `styles.css` — tampilan (terang/gelap, responsif)
- `app.js` — logika tracker, tema, ekspor/impor
- `manifest.json` — metadata PWA
- `service-worker.js` — cache offline
- `icons/` — ikon aplikasi

## Backup data

Data disimpan di browser perangkat. Untuk pindah perangkat: tekan ⭳ untuk mengunduh file backup `.json`, lalu di perangkat baru tekan ⭱ dan pilih file tersebut.
