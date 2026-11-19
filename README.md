# Smart Waste — Portal Warga

Website warga untuk membuat laporan sampah dan memantau tindak lanjutnya. Website dan aplikasi Android operasional memakai PHP REST API dan database MySQL yang sama.

## Fitur website

- Daftar, masuk, dan kelola profil warga.
- Kirim laporan dengan jenis sampah, perkiraan berat, lokasi, deskripsi, dan foto.
- Lihat ringkasan, tren laporan, progres tiap laporan, riwayat status, petugas, kendaraan, dan tujuan TPA yang sudah ditetapkan.
- Edit atau batalkan laporan sesuai statusnya.
- Sinkronkan perubahan status dari aplikasi operasional secara berkala.

## Struktur

- `frontend/` — halaman, stylesheet, JavaScript, dan aset portal warga.
- `backend-php/` — REST API, konfigurasi database, bootstrap schema, dan layanan backend.
- `backend-php/database/schema.sql` — referensi struktur database.
- `docs/` — kontrak API dan panduan pengembangan.
- `tools/` — skrip bantu proyek.

## Menjalankan secara lokal dengan XAMPP

1. Letakkan folder proyek pada document root Apache dengan nama/path `Waste2`.
2. Nyalakan Apache dan MySQL. Frontend memakai API default `http://<host>:8080/Waste2/backend-php/index.php`; sesuaikan port atau path API di `frontend/js/app.js` jika konfigurasi Apache berbeda.
3. Salin `backend-php/.env.example` menjadi `backend-php/.env`, lalu atur koneksi database lokal. Jangan gunakan konfigurasi database lokal untuk server publik.
4. Buka `http://localhost:8080/Waste2/frontend/index.html` di Chrome. Endpoint pemeriksaan API: `http://localhost:8080/Waste2/backend-php/index.php/health`.

Backend menyiapkan schema saat pertama kali digunakan. Untuk jaringan atau server produksi, gunakan kredensial database tersendiri dan jangan commit `.env`, foto laporan, atau salinan database.
