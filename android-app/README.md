# Smart Waste — Android Admin & Petugas

Aplikasi Android Kotlin/Jetpack Compose untuk Admin dan Petugas. Website warga, Android, dan PHP REST API berada dalam satu project ini dan berbagi database MySQL XAMPP yang sama.

## Peta kode aplikasi

```text
app/src/main/java/com/uoi/pratikumwithbunafla/
├── MainActivity.kt             # Entry point, navigasi, role gate, orkestrasi data
├── data/
│   ├── model/Models.kt          # Model akun, laporan, dashboard, armada, statistik
│   └── remote/SmartWasteApi.kt  # Satu client untuk seluruh endpoint PHP
├── domain/WasteFlow.kt         # Aturan status laporan yang dipakai bersama
└── ui/
    ├── admin/AdminScreens.kt   # Dashboard, laporan, admin, operasional, petugas
    ├── auth/LoginScreen.kt     # Login username/password dan pemilihan role
    ├── components/UiComponents.kt
    └── theme/                  # Warna, tipografi, Material theme
```

- `app/src/test/` — unit test aturan status.
- `docs/design/` — referensi desain/QA. Berkas konfigurasi LAN dan dokumen sekolah tetap lokal dan tidak disertakan di repo publik.
- `gradle/libs.versions.toml` — katalog versi plugin dan dependency.

## Menjalankan dan mengetes

1. Nyalakan Apache dan MySQL di XAMPP.
2. Buka folder ini di Android Studio atau jalankan `OPEN-AndroidStudio-SmartWaste.bat`.
3. Alamat API ditentukan saat build melalui `apiHost` di `app/lan.properties` atau Gradle dengan `-PsmartWasteApiHost=HOST_SERVER`. Jalankan emulator atau HP pada Wi-Fi yang sama dengan server. Jika alamat awal tidak merespons, aplikasi mencoba menemukan API secara otomatis pada jaringan lokal.
4. Untuk HP fisik, jalankan `scripts/auto-deploy-phone.ps1` pada laptop server saat HP tersambung ke Wi-Fi yang sama. Skrip memilih IP Wi-Fi server, membangun APK dengan URL REST API LAN, menerbitkan APK dan manifest ke folder `updates` website, lalu memasang APK ke HP yang tersambung USB. Apache port `8080` harus dapat dijangkau dari Wi-Fi; jangan membuka port MySQL `3306` ke perangkat lain.
5. APK yang sudah memiliki pemeriksa pembaruan mengecek server saat dibuka dan berkala saat aplikasi aktif. Pengguna menekan tombol pembaruan, lalu Android tetap meminta konfirmasi pemasangan. Semua HP lain perlu memasang APK LAN ini sekali terlebih dahulu; versi lama belum memiliki pemeriksa pembaruan. Untuk kestabilan, atur DHCP reservation agar IP laptop tidak berubah.
6. Validasi dengan:

   ```powershell
   .\gradlew.bat :app:testDebugUnitTest :app:lintDebug :app:assembleDebug
   ```

## Konfigurasi akun dan server

- Admin dan Petugas masuk memakai username dan kata sandi yang dibuat admin pertama. Website tetap memakai login user dengan username/email dan kata sandi.
- Untuk database baru, atur `SMARTWASTE_BOOTSTRAP_ADMIN_PASSWORD` (minimal 8 karakter) pada `backend-php/.env` sebelum setup. Akun `admin` hanya dibuat saat belum ada; akun lama tidak diubah. PHP membaca konfigurasi database XAMPP dari variabel `SMARTWASTE_DB_HOST`, `SMARTWASTE_DB_PORT`, `SMARTWASTE_DB_NAME`, `SMARTWASTE_DB_USER`, dan `SMARTWASTE_DB_PASSWORD`.
- Nilai default database cocok untuk XAMPP lokal: `127.0.0.1:3306`, database `smart_waste`, user `root`, password kosong.
- Detail API, role, dan alur perubahan ada di [docs/architecture.md](docs/architecture.md) dan README project web `Waste 2`.
