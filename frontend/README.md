# SmartWaste — Portal Warga

Website ini untuk warga/pelapor. Website dan aplikasi Android Admin/Petugas memakai PHP REST API serta database MySQL yang sama dari proyek **Smart Waste 2**:

~~~text
Portal Warga ─┐
              ├── PHP REST API ── MySQL
Android Admin/Petugas ─┘
~~~

Laporan yang dikirim warga muncul di aplikasi operasional. Perubahan status, petugas, armada, TPA, catatan, dan bukti penanganan dari Android akan muncul di website saat data diperbarui.

## Menjalankan

1. Nyalakan Apache, PHP API, dan MySQL dari proyek Smart Waste 2. Ikuti petunjuk pada README proyek tersebut.
2. Buka http://localhost/Waste2/frontend/. Halaman landing akan terbuka otomatis.

Portal dan API memakai Apache XAMPP yang sama. Folder `C:\xampp\htdocs\Waste2` adalah junction menuju folder proyek ini, jadi portal tetap tersedia selama Apache aktif dan tidak bergantung pada server Python sementara.

Secara default, website menghubungi alamat API dengan hostname halaman dan port 8080 di jalur /Waste2/backend-php/index.php. Untuk alamat API lain, tetapkan window.SMART_WASTE_API sebelum assets/js/data.js dimuat di index.html.

Jika API tidak aktif atau alamatnya keliru, website menampilkan pesan koneksi dan tidak memakai data contoh lokal sebagai pengganti.

## Peran dan alur

- Website hanya menerima akun warga (role: user). API menolak login Admin/Petugas melalui website.
- Pendaftaran warga dilakukan di website. Akun Petugas dibuat oleh Admin di aplikasi Android.
- Setelah website dibuka ulang, warga harus memasukkan username dan password lagi.
- Warga dapat membuat laporan, melihat status dan riwayat, mengedit atau membatalkan laporan yang masih menunggu verifikasi, serta mengelola profil.
- Foto kondisi awal wajib dan diunggah ke API. Foto bukti lokasi dan bukti penyelesaian dari Petugas tampil pada detail laporan.
- Website memuat ulang data secara berkala saat sesi aktif. Status yang sudah diperbarui Admin/Petugas ditampilkan bersama nama petugas, nomor kendaraan, TPA, catatan, serta riwayat status yang dikirim API.

## Status bersama

| API / Android | Tampilan website |
|---|---|
| menunggu_verifikasi | Menunggu Verifikasi |
| diproses | Diproses |
| ditugaskan | Ditugaskan |
| diangkut | Diangkut |
| selesai | Selesai |
| ditolak | Ditolak |
| dibatalkan | Dibatalkan warga |

## Endpoint warga

assets/js/data.js mengirim permintaan ke API bersama:

| Fitur | Endpoint |
|---|---|
| Login / daftar | POST /auth/login, POST /auth/register |
| Profil / ganti password | GET /me, PUT /me, POST /me/foto-profil, PATCH /me/password |
| Daftar / detail laporan | GET /laporan/mine, GET /laporan/{id} |
| Buat / edit / batalkan | POST /laporan, PUT /laporan/{id}, DELETE /laporan/{id} |

Semua operasi laporan dan profil selain daftar/login membutuhkan token API. Pemeriksaan role dan kepemilikan laporan dilakukan oleh server.

## Struktur

~~~text
index.html              # Kerangka aplikasi, layar autentikasi, dan shell
landing.html            # Landing page warga
assets/css/              # Gaya portal dan landing page
assets/js/data.js        # Client REST API bersama dan normalisasi data
assets/js/app.js         # Router, tampilan, formulir, dan interaksi warga
~~~

Akun, laporan, status, dan foto tersimpan di server bersama. Browser hanya menyimpan token sesi, draft laporan yang belum dikirim, dan penanda notifikasi yang sudah dibaca.
