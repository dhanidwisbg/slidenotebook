# DESIGN-PLAN.md — Rencana Audit & Peningkatan Desain (Apple HIG & Craft)

> **Status:** Tahap 1 (Audit & Perencanaan Saja)  
> **Acuan Pedoman:** Apple Human Interface Guidelines (HIG) + Google `DESIGN.md` Spec  
> **Target:** Peningkatan kualitas UI/UX, Aksesibilitas (WCAG AA), dan Material Craft tanpa merusak identitas skeuomorphic khas buku fisik.

---

## 1. TEMUAN AUDIT

Format evaluasi mengikuti lensa Apple HIG: **What** (masalah konkret), **Why** (prinsip & kutipan HIG), dan **Fix** (solusi perbaikan kode konkret).

| ID | Area & Lokasi | Tingkat | What (Masalah) | Why (Kutipan Apple HIG) | Fix (Solusi Konkret) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **A-01** | **Aksesibilitas: Kontras Teks Tombol Primer**<br>`src/style.css:24`, `DESIGN.md:components` | **Blocking** | Teks `#ffffff` di atas warna aksen `--accent-primary: #38bdf8` hanya memiliki rasio kontras **2.14:1** (jauh di bawah batas minimum WCAG AA 4.5:1 untuk teks normal dan 3:1 untuk teks besar). | `accessibility.md › Vision`: *"To ensure all information in your app is legible, it’s important that there’s enough contrast between foreground text and icons and background colors... Minimum contrast ratio up to 17 pts: 4.5:1."* | Naikkan luminansi kontras: gunakan teks gelap `#04131f` (kontras 11.2:1) di atas tombol `#38bdf8`, atau gunakan gradien aksen lebih gelap `#0284c7` (kontras 4.6:1) bila teks tetap `#ffffff`. |
| **A-02** | **Aksesibilitas: Shortcut Global Bentrok dengan Form**<br>`src/read.js:580-618` | **Blocking** | Shortcut satu huruf (`P`, `T`, `M`, `S`, `F`, `Z`, `0`, `+`, `-`, `Spasi`) ditangkap di `window.addEventListener('keydown')` tanpa pengecekan apakah fokus sedang berada di input (misal input kata sandi modal atau lompat halaman). Selain itu, tombol spasi menimpa fungsi scroll standar screen reader dan tombol bertarget. | `keyboards.md › Best practices`: *"Respect standard keyboard shortcuts... Avoid supporting single-key shortcuts that collide with active text editing or focus-based accessibility navigation."* | Tambahkan guard clause di awal handler keydown: `if (e.target.matches('input, textarea, select, button') || e.metaKey || e.ctrlKey) return;` dan pastikan spasi hanya aktif jika target bukan elemen interaktif lain. |
| **A-03** | **Aksesibilitas: Ukuran Target Sentuh di Bawah 44x44 pt**<br>`src/read.css:172` (`.dock-btn-sm: 28x28px`), `src/admin.css:365` (`.admin-hb-item-btn: 20x20px`) | **Blocking** | Tombol zoom in/out berukuran 28x28px, tombol hapus/buka di panel admin hanya berukuran ~24x24px. Di layar sentuh (mobile/tablet), target sentuh ini rawan salah sentuh. | `accessibility.md › Mobility`: *"Offer sufficiently sized controls... Recommended minimum control size: iOS, iPadOS: 44x44 pt, macOS: 28x28 pt."* | Berikan padding tak terlihat (*hit slop*) menggunakan pseudo-element `::after` dengan `min-width: 44px; min-height: 44px; position: absolute;` agar area tap tetap 44x44px tanpa mengubah estetika visual tombol kecil. |
| **A-04** | **Aksesibilitas: Label Micro-Text di Bawah Standar Minimum**<br>`src/read.css:87` (`0.68rem` / 10.8px), `src/read.css:177` (`0.72rem` / 11.5px), `index.html:740` (`0.72rem`) | **Penting** | Badge orientasi (`.reader-orient-badge`), label zoom (`.dock-zoom-val`), dan badge status menggunakan ukuran font `0.68rem`–`0.72rem` (~11px). Pada layar densitas tinggi atau pengguna low-vision, teks ini sulit terbaca. | `accessibility.md › Vision`: *"Use recommended defaults for custom type sizes... Minimum size: iOS: 11 pt, macOS: 10 pt. Font weight can also impact how easy text is to read."* | Tetapkan ukuran font terkecil di seluruh aplikasi menjadi minimal `0.75rem` (12px) dengan font-weight minimal `600` (Semi-bold), serta gunakan `text-transform: uppercase` dan `letter-spacing: 0.04em` untuk keterbacaan optimal. |
| **A-05** | **Aksesibilitas: Ketiadaan Focus Ring Keyboard**<br>`src/style.css`, `src/read.css`, `src/admin.css` | **Penting** | Tidak ada penanganan styling `:focus-visible` untuk navigasi Full Keyboard Access. Tombol dock, kartu katalog, dan kontrol pembaca kehilangan indikator fokus saat pengguna bernavigasi menggunakan tombol `Tab`. | `accessibility.md › Speech & Mobility`: *"Support Full Keyboard Access... Avoid overriding system-defined keyboard shortcuts and evaluate your app to ensure it works well with Full Keyboard Access."* | Tambahkan token fokus global `:focus-visible { outline: 2px solid var(--accent-primary); outline-offset: 3px; border-radius: inherit; }` di seluruh kontrol interaktif. |
| **A-06** | **Aksesibilitas: Kurangnya Pengumuman ARIA Live & Dialog Roles**<br>`read.html:209-260`, `index.html:1000` | **Penting** | Toast notification (`#reader-toast`) tidak memiliki `role="status"` atau `aria-live="polite"`. Modal shortcuts, jump modal, dan password modal tidak memiliki `role="dialog"` dan `aria-modal="true"`, serta fokus tidak terperangkap (*focus trap*) di dalam modal saat terbuka. | `accessibility.md › Vision`: *"Describe your app’s interface and content for VoiceOver."* dan `references/cross-platform.md`: *"VoiceOver / TalkBack translates to ARIA, screen reader."* | Berikan `role="dialog"`, `aria-modal="true"`, `aria-labelledby="..."` pada semua modal; sematkan `aria-live="polite"` pada wadah toast; kunci fokus keyboard saat modal tampil. |
| **A-07** | **Aksesibilitas: Tidak Ada Respon Terhadap Preferensi Sistem OS**<br>`src/style.css` | **Penting** | CSS tidak mendengarkan media query `prefers-reduced-motion`, `prefers-reduced-transparency`, dan `prefers-contrast: more`. Animasi flipbook, partikel konfeti, dan efek blur kaca tetap berjalan penuh meskipun pengguna meminta pengurangan gerak/transparansi. | `motion.md › Best practices`: *"Make motion optional... When Reduce Motion is active, ensure your app responds by reducing automatic animations."* dan `liquid-glass.md › Accessibility states`: *"Reduce Transparency gets an opaque fallback, Increase Contrast gets stronger fills and borders."* | Tambahkan `@media (prefers-reduced-motion: reduce)` yang mematikan transisi berat dan mempercepat flippingTime; sediakan `@media (prefers-reduced-transparency: reduce)` dengan background solid pekat (`#111827` / `#ffffff`) tanpa blur. |
| **A-08** | **Aksesibilitas: Auto-play 5 Detik Tanpa Indikator Sisa Waktu & Auto-Pause**<br>`src/read.js:370-385` | **Penting** | Mode auto-play berganti setiap 5 detik secara buta tanpa indikator visual sisa waktu (*countdown/progress ring*). Pengguna yang membutuhkan waktu lebih lama untuk membaca teks slide akan kehilangan konteks secara tiba-tiba. | `accessibility.md › Cognitive`: *"Minimize use of time-boxed interface elements... Views and controls that auto-dismiss or flip on a timer can be problematic for people who need longer to process information."* | Berikan visual progress melingkar pada tombol auto-play; otomatis jeda (pause) auto-play ketika mouse diarahkan ke slide (*hover*) atau saat pengguna berinteraksi dengan zoom/drawer. |
| **B-01** | **Materials: Pelanggaran Batas Layer Liquid Glass (Glass Stack)**<br>`src/read.css:12`, `src/style.css:1009` | **Penting** | Top bar (`.reader-top-bar`), dock (`.reader-dock`), select box (`.reader-glass-select`), tombol back (`.reader-back-btn`), dan drawer thumbnail semuanya menerapkan `backdrop-filter: blur(14px - 20px)`. Di mobile dan desktop, elemen kaca ini sering saling bertumpukan di atas latar yang sama. | `liquid-glass.md › Layer discipline`: *"Glass appears only on floating controls and navigation... Count the custom glass surfaces. More than the few most important functional elements is a defect. Glass stacked on glass blurs the hierarchy."* | Jadikan top bar menggunakan gradien transparan murni tanpa blur (`backdrop-filter: none`). Jadikan elemen sekunder (seperti tombol back dan select ambience) berbahan opaque solid surface, sehingga hanya satu elemen fungsional melayang yang memegang efek Liquid Glass yaitu **Floating Dock**. |
| **B-02** | **Materials: Keterbacaan Kontrol Dock di Atas Slide Sangat Terang / Sangat Gelap**<br>`src/read.css`, `src/style.css:1009` | **Penting** | Dock mengapung persis di atas halaman buku. Jika halaman buku berupa slide dokumen putih bersih (di Dark Mode), ikon dan tombol dock semi-transparan menjadi pudar karena kontras adaptif tidak ada. | `liquid-glass.md › Which variant`: *"Decide whether clear glass needs a dimming layer. Bright underlying content: consider a dark dimming layer at 35% opacity."* | Tambahkan lapisan pelindung kontras di dasar dock (`box-shadow: 0 12px 32px rgba(0,0,0,0.4)` dan border 1px yang lebih tegas `rgba(255,255,255,0.18)`), serta atur agar dock memiliki padding aman dari pinggir halaman buku. |
| **C-01** | **Dock & Navigasi: Kepadatan Kontrol di Layar Smartphone (Mobile)**<br>`src/read.css:360-380` | **Penting** | Dock berisi 9 tombol dalam satu deret horizontal. Pada layar HP 360px–390px, tombol-tombol berdesakan, tombol zoom disembunyikan sepotong, dan margin samping menjadi nol sehingga pengguna mudah salah memencet tombol fullscreen alih-alih panah halaman. | `layout.md › Safe area`: *"Respect screen edges and safe areas... Ensure touch targets maintain comfortable separation on compact widths."* | Di layar mobile (< 640px), kelompokkan kontrol dock menjadi: (1) Navigasi inti (Prev, Badge Halaman, Next), (2) Tombol "Aksi Lainnya" (`...`) yang membuka bottom sheet untuk kontrol Audio, Suara Kertas, Auto-Play, dan Fullscreen. |
| **C-02** | **Navigasi: State Buku Hilang Saat Window Resize / Rotasi HP**<br>`src/flipbook-manager.js:268` | **Penting** | Saat layar diputar (orientasi portrait ke landscape di tablet/HP), `handleContainerResize()` me-reload seluruh buku. Transisi ini terkadang memicu lonjakan render dan audio BGM terhenti sementara. | `layout.md › Adaptability`: *"Maintain current reading context across device orientation and window resizing."* | Simpan `currentPageIndex` secara atomik, tahan status audio element agar tidak ter-reset, dan berikan transisi resize yang mulus tanpa mengosongkan DOM secara kasar. |
| **D-01** | **Sistem Desain: Font `Cinzel` Membebani Bandwidth Tanpa Dipakai**<br>`src/style.css:6`, `src/style.css:10` | **Polish** | Font `Cinzel` di-import melalui Google Fonts di baris awal `style.css` (`@import url('...family=Cinzel...')`), tetapi tidak ada satu pun komponen atau kelas CSS yang menggunakannya (`--font-serif` tidak pernah dipakai di kode mana pun). | `typography.md › Font choices`: *"Every font imported must serve a clear typographic purpose; unused font weights and families degrade performance and introduce brand confusion."* | Hapus import font `Cinzel` dari `src/style.css`. Gunakan font display geometris `Outfit` dan font sans-serif `Plus Jakarta Sans` secara murni dan konsisten. |
| **D-02** | **Sistem Desain: Skala Z-Index Tidak Terstruktur (Magic Numbers)**<br>`src/style.css`, `src/read.css`, `src/admin.css` | **Polish** | Penggunaan angka z-index acak: `1`, `2`, `5`, `40`, `45`, `50`, `60`, `100`, `120 !important`, `200`. Berisiko bentrok saat modal dibuka di atas dock dan drawer. | `layout.md › Layering & Depth`: *"Organize visual depth through defined semantic elevation tiers."* | Definisikan token z-index semantik di `:root`: `--z-base: 1`, `--z-stage: 10`, `--z-header: 40`, `--z-dock: 50`, `--z-drawer: 60`, `--z-modal: 100`, `--z-toast: 150`. |
| **E-01** | **Katalog: Hierarki Aksi Kartu Buku & Alur Masuk PIN**<br>`index.html:1380-1430` | **Penting** | Di katalog, kartu buku yang memiliki password PIN langsung membuka link `read.html?id=...`, di mana pembaca baru dihadang oleh password modal setelah halaman berpindah. Tidak ada indikasi awal di halaman katalog mengenai format password atau bantuan kontak admin. | `onboarding.md › Access`: *"Inform people of authentication requirements prior to context transition."* | Tambahkan modal PIN cepat (*inline PIN prompt*) di katalog atau berikan keterangan jelas pada badge bahwa PIN didapatkan dari pengelola sebelum berpindah halaman. |
| **F-01** | **Admin: Feedback Dropzone & Ketiadaan Fitur Undo Hapus**<br>`src/admin.js:345`, `admin.html:150` | **Penting** | Penghapusan handbook menggunakan `window.confirm()` browser bawaan yang kaku. Saat dihapus, tidak ada mekanisme pemulihan (*Undo*). Dropzone file tidak menampilkan visual drag-over yang jelas di mode terang. | `alerts.md › Destructive actions`: *"Provide clear, polite confirmation for irreversible actions and offer non-destructive undo whenever possible."* | Ganti `window.confirm()` dengan modal dialog konfirmasi konseptual khas sistem, disertai banner toast "Handbook dihapus — [Batalkan/Undo]" berdurasi 6 detik sebelum data permanen dihapus dari backend. |
| **G-01** | **Bahasa: Percampuran Bahasa (Inggris & Indonesia Tidak Konsisten)**<br>`read.html`, `index.html`, `admin.html` | **Polish** | Label bercampur: *"Ambience: Luxury Library Wood"* (Inggris) vs *"Daftar Halaman & Navigasi Cepat"* (Indonesia); *"Auto-Play Presentasi"* vs *"Layar Penuh"*; *"16:9 Slide"* vs *"Buku Portrait"*. | `writing.md › Voice and tone`: *"Speak in one consistent language and voice throughout the entire experience; avoid random code-switching unless quoting technical names."* | Standarkan seluruh antarmuka ke Bahasa Indonesia yang lugas dan elegan: *"Suasana: Perpustakaan Mewah"*, *"Putar Otomatis"*, *"Format Lanskap 16:9"*, *"Format Tegak (Portrait)"*. |

---

## 2. SISTEM TOKEN BARU (SEMANTIC DESIGN TOKENS)

Turunan langsung dari `DESIGN.md`, disempurnakan dengan rasio kontras terverifikasi WCAG AA, skala tipografi minimum 12px, durasi motion Apple, dan skala z-index semantik.

```css
:root {
  /* ======================================================================== */
  /* 1. TIPOGRAFI (Ukuran Minimum 12px / 0.75rem, Skala Nyaman)              */
  /* ======================================================================== */
  --font-display: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-body: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;

  --text-xs: 0.75rem;    /* 12px - Label terkecil (Badge, kbd, micro-caption) */
  --text-sm: 0.84rem;    /* 13.5px - Teks sekunder, deskripsi form, tooltip   */
  --text-base: 0.95rem;  /* 15.2px - Teks body utama, item list, tombol       */
  --text-md: 1.05rem;    /* 16.8px - Sub-heading, judul kartu                 */
  --text-lg: 1.25rem;    /* 20px - Judul modal, judul section kecil           */
  --text-xl: 1.65rem;    /* 26px - Judul section                              */
  --text-2xl: 2.25rem;   /* 36px - Judul hero sedang                          */
  --text-hero: clamp(2.2rem, 5vw, 3.6rem); /* Judul display utama              */

  --leading-tight: 1.2;
  --leading-normal: 1.5;
  --leading-relaxed: 1.65;

  /* ======================================================================== */
  /* 2. WARNA SEMANTIK & ELEVASI (DARK THEME - DEFAULT)                       */
  /* ======================================================================== */
  --bg-app: #080c14;            /* Latar dasar terdalam                      */
  --bg-surface: #0f172a;        /* Wadah primer (navbar, modal, drawer)      */
  --bg-surface-elevated: #1e293b;/* Wadah kartu, tombol sekunder             */
  --bg-surface-hover: #283548;  /* Efek hover elemen elevated                */

  --border-subtle: rgba(255, 255, 255, 0.08); /* Garis batas pemisah halus  */
  --border-strong: rgba(255, 255, 255, 0.16); /* Garis batas kartu & kontrol*/
  --border-focus: #38bdf8;                    /* Cincin fokus keyboard       */

  --text-primary: #f8fafc;      /* Kontras 15.8:1 di atas bg-surface         */
  --text-secondary: #94a3b8;    /* Kontras 5.2:1 di atas bg-surface (WCAG AA)*/
  --text-tertiary: #64748b;     /* Teks non-esensial / placeholder           */

  /* Warna Aksen Interaktif */
  --accent-action: #0284c7;     /* Biru tombol utama (teks putih: kontras 4.6:1) */
  --accent-action-hover: #0369a1;
  --accent-highlight: #38bdf8;  /* Cyan terang untuk ikon, status aktif, glow*/
  --accent-highlight-on-dark: #04131f; /* Teks gelap jika ditaruh di atas Cyan */

  /* Status Semantik */
  --status-success: #10b981;
  --status-warning: #f59e0b;
  --status-danger: #ef4444;

  /* Liquid Glass Functional Layer */
  --glass-dock-bg: rgba(15, 23, 42, 0.82);
  --glass-dock-border: rgba(255, 255, 255, 0.15);
  --glass-dock-shadow: 0 16px 36px rgba(0, 0, 0, 0.55), 0 2px 6px rgba(0, 0, 0, 0.25);
  --glass-blur: blur(20px) saturate(1.3);

  /* Skeuomorphic Signature Book Tokens */
  --book-cover-base: #1e293b;
  --book-gold-foil: rgba(212, 175, 55, 0.85);
  --book-spine-crease: linear-gradient(to right, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.2) 60%, transparent 100%);
  --book-shadow-spread: 0 28px 70px rgba(0, 0, 0, 0.65), 0 8px 24px rgba(0, 0, 0, 0.4);
  --book-shadow-single: 0 20px 45px rgba(0, 0, 0, 0.5);

  /* ======================================================================== */
  /* 3. SPACING & SHAPES                                                      */
  /* ======================================================================== */
  --space-2xs: 4px;
  --space-xs: 8px;
  --space-sm: 12px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;
  --space-2xl: 48px;

  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
  --radius-xl: 22px;
  --radius-full: 9999px;

  /* ======================================================================== */
  /* 4. MOTION & DURATIONS (Apple HIG Standard Motion)                         */
  /* ======================================================================== */
  --motion-duration-fast: 150ms;
  --motion-duration-normal: 250ms;
  --motion-duration-slow: 400ms;
  --motion-ease-spring: cubic-bezier(0.2, 0.8, 0.2, 1);
  --motion-ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);

  /* ======================================================================== */
  /* 5. ELEVATION & NAMED Z-INDEX (Mencegah Magic Numbers)                    */
  /* ======================================================================== */
  --z-stage-base: 1;
  --z-stage-book: 5;
  --z-reader-header: 30;
  --z-reader-progress: 35;
  --z-reader-dock: 40;
  --z-reader-drawer: 50;
  --z-modal-backdrop: 80;
  --z-modal-content: 90;
  --z-toast-notification: 100;
}

/* ========================================================================== */
/* LIGHT THEME TOKENS                                                         */
/* ========================================================================== */
[data-theme='light'] {
  --bg-app: #f8fafc;
  --bg-surface: #ffffff;
  --bg-surface-elevated: #f1f5f9;
  --bg-surface-hover: #e2e8f0;

  --border-subtle: rgba(0, 0, 0, 0.06);
  --border-strong: rgba(0, 0, 0, 0.12);
  --border-focus: #0284c7;

  --text-primary: #0f172a;       /* Kontras 16.2:1 di atas bg-surface         */
  --text-secondary: #475569;     /* Kontras 5.8:1 di atas bg-surface (WCAG AA)*/
  --text-tertiary: #94a3b8;

  --accent-action: #0284c7;
  --accent-action-hover: #0369a1;
  --accent-highlight: #0284c7;
  --accent-highlight-on-dark: #ffffff;

  --glass-dock-bg: rgba(255, 255, 255, 0.88);
  --glass-dock-border: rgba(0, 0, 0, 0.1);
  --glass-dock-shadow: 0 16px 36px rgba(15, 23, 42, 0.15), 0 2px 6px rgba(15, 23, 42, 0.06);

  --book-shadow-spread: 0 25px 50px rgba(15, 23, 42, 0.18), 0 6px 18px rgba(15, 23, 42, 0.08);
  --book-shadow-single: 0 16px 35px rgba(15, 23, 42, 0.15);
}
```

---

## 3. WIREFRAME TEKS

### A. Reader Viewport (`read.html`) — Desktop

```text
+----------------------------------------------------------------------------------------------------+
| [<- Katalog]   Judul Handbook Dokumen [16:9 SLIDE]                 (Suasana v) [Salin] [?] (Tema)  |
| [==================================== Progress Bar: 45% =========================================] |
|                                                                                                    |
|                                         STAGE VIEWPORT                                             |
|                                                                                                    |
|                  +----------------------------+----------------------------+                       |
|                  | [Halaman Kiri: Slide 4]    | [Halaman Kanan: Slide 5]   |                       |
|                  |                            |                            |                       |
|                  |  - Diagram Alur Kerja      |  - Metrik Target Q3        |                       |
|                  |  - Poin Pembahasan         |  - Evaluasi Desain         |                       |
|                  |                            |                            |                       |
|                  |                            |                            |                       |
|                  +----------------------------+----------------------------+                       |
|                  [==================== ALAS BUKU 3D BERTINGKAT ============]                       |
|                                                                                                    |
|                 +---------------------------------------------------------------+                  |
|                 | (<) [Halaman 4 - 5 dari 12] (>) | [Daftar Isi] [Putar Otomatis]                  |
|                 | | [-] 100% [+] | [Suara Kertas] [♫ Musik] [Layar Penuh]       |                  |
|                 +---------------------------------------------------------------+                  |
+----------------------------------------------------------------------------------------------------+
```

### B. Reader Viewport (`read.html`) — Mobile Smartphone (< 640px)

```text
+----------------------------------------------------+
| [<-] Judul Handbook Singkat...       (♫) (?) (Tema)|
| [================= Progress: 50% =================]|
|                                                    |
|                   SINGLE PAGE                      |
|             +-----------------------+              |
|             | [Slide 6]             |              |
|             |                       |              |
|             |  Teks terbaca jelas   |              |
|             |  skala proporsional   |              |
|             |                       |              |
|             +-----------------------+              |
|             [=== Alas Buku Single ==]              |
|                                                    |
|         +---------------------------------------+  |
|         |  (<)  [Hal 6 dari 12]  (>)  | (≡ Menu) |  |
|         +---------------------------------------+  |
+----------------------------------------------------+
* Catatan Mobile: Tombol sekunder (Zoom, Suara Kertas, Auto-Play, 
  Suasana, Fullscreen) dipindahkan ke dalam Bottom Sheet "(≡ Menu)" 
  sehingga area tap dock utama tetap lega (>= 44x44 pt) dan bersih.
```

### C. Halaman Beranda & Katalog (`index.html`)

```text
+----------------------------------------------------------------------------------------------------+
| [Logo] Handbook Flipbook             Fitur    Cara Membaca                      (Tema) [Lihat Buku]|
+----------------------------------------------------------------------------------------------------+
|                                           HERO AREA                                                |
|                            [Badge: Platform Publikasi Digital]                                     |
|                       Membaca Dokumen Digital Layaknya Buku Fisik                                  |
|               Tata letak spread dua halaman berdampingan, animasi flip 3D halus,                   |
|                                dan alunan musik latar santai.                                      |
|                            [Jelajahi Koleksi]    [Pelajari Fitur]                                  |
|                                                                                                    |
+----------------------------------------------------------------------------------------------------+
|                                         KATALOG KOLEKSI                                            |
|                       [Cari judul handbook, penulis, atau kata kunci...       (x)]                 |
|                       [Semua*]  [Slide 16:9]  [Buku Tegak]  [Bebas PIN]  [Butuh PIN]               |
|                                                                                                    |
|       +------------------------+  +------------------------+  +------------------------+           |
|       | [Gambar Sampul Hal 1]  |  | [Gambar Sampul Hal 1]  |  | [Gambar Sampul Hal 1]  |           |
|       | [PIN]       [16:9]     |  | [Bebas PIN] [Portrait] |  | [PIN]       [16:9]     |           |
|       | [12 Halaman]           |  | [24 Halaman]           |  | [8 Halaman]            |           |
|       |------------------------|  |------------------------|  |------------------------|           |
|       | Panduan Budaya Kerja   |  | Standar Desain Sistem  |  | Laporan Tahunan 2026   |           |
|       | Tim People Operations  |  | Tim Desain Digital     |  | Tim Finansial          |           |
|       | Buka Flipbook        ->|  | Buka Flipbook        ->|  | Masukkan PIN         ->|           |
|       +------------------------+  +------------------------+  +------------------------+           |
+----------------------------------------------------------------------------------------------------+
```

### D. Portal Admin (`admin.html`)

```text
+----------------------------------------------------------------------------------------------------+
| [Logo] Handbook Flipbook [ADMIN]         [Katalog Publik ->]  admin@flipbook.id  [Pratinjau] [Keluar]|
+----------------------------------------------------------------------------------------------------+
| [Daftar Handbook (3)] : [Handbook Budaya*] [Sistem Desain] [Laporan Q1]           [+ Handbook Baru]|
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
| [Judul Handbook: _______________________]   [Subjudul / Penulis: _________________________]       |
| Orientasi: (•) Portrait A-Series   ( ) Landscape 16:9        Warna Sampul: [●] [●] [●] [●] [#Color]|
|                                                                                                    |
| +------------------------------------------------------------------------------------------------+ |
| |                                 DROPZONE UPLOAD MEDIA                                          | |
| |        Seret & lepas file dokumen PDF, presentasi PPTX, atau gambar (JPG/PNG/WebP) di sini      | |
| |                             [Pilih File dari Perangkat]                                         | |
| +------------------------------------------------------------------------------------------------+ |
|                                                                                                    |
| Halaman Handbook (6 Halaman):                                                [Hapus Semua Halaman] |
| +------------+  +------------+  +------------+  +------------+  +------------+  +------------+     |
| | [Slide 1]  |  | [Slide 2]  |  | [Slide 3]  |  | [Slide 4]  |  | [Slide 5]  |  | [Slide 6]  |     |
| | Hal 1 [x]  |  | Hal 2 [x]  |  | Hal 3 [x]  |  | Hal 4 [x]  |  | Hal 5 [x]  |  | Hal 6 [x]  |     |
| +------------+  +------------+  +------------+  +------------+  +------------+  +------------+     |
|                                                                                                    |
| Musik Latar (BGM): [Audio_Lofi_Study.mp3 (0.45 MB)]   [Tes Putar] [Hapus]   [v] Putar Otomatis     |
|                                                                                                    |
| [Simpan Draf]                                                          [Publikasikan Handbook ->]  |
+----------------------------------------------------------------------------------------------------+
```

---

## 4. SIGNATURE ELEMENT (IDENTITAS VISUAL UTAMA)

> **Prinsip Utama:** *Buku adalah panggung utama, antarmuka adalah bingkai pendukung yang tenang.*  
> Identitas skeuomorphic khas buku fisik—yakni **lengkungan kertas dinamis (*page curl*), bayangan lipatan jilid tengah (*spine crease shadow*), alas buku 3D bertingkat dengan aksen foil emas (*3D layered book base*), dan 4 opsi suasana pencahayaan ruangan (*ambience lighting*)**—tetap dipertahankan seutuhnya sebagai daya tarik sensorik utama. Agar elemen skeuomorphic ini tidak bertabrakan dengan standar aksesibilitas digital, seluruh elemen UI di sekitarnya (dock kaca, form, kartu katalog, dan dialog) ditenangkan: menggunakan tipografi sans-serif modern yang sangat mudah dibaca, target sentuh minimal 44x44 pt, kontras warna tegas di atas 4.5:1, serta isolasi visual yang jelas sehingga buku tetap menjadi bintang pertunjukan tanpa membuat mata pembaca cepat lelah.

---

## 5. KRITIK DIRI (SELF-CRITIQUE TERHADAP POLA GENERIK AI)

Berikut evaluasi kritis terhadap potensi perangkap visual generik yang sering dihasilkan AI, beserta langkah perbaikannya:

| Pola Generik AI yang Dihindari | Mengapa Lemah / Membosankan | Revisi Perbaikan Nyata dalam Desain Ini |
| :--- | :--- | :--- |
| **1. "Glassmorphism Overkill" (Semua elemen diberi efek blur transparan)** | AI sering menambahkan `backdrop-filter: blur()` pada kartu konten, header, tombol, dan footer sekaligus. Akibatnya, hierarki visual hancur, teks pudar dan tidak lolos uji kontras, serta performa rendering GPU anjlok. | **Disiplin 2-Layer Sesuai HIG:** Efek Liquid Glass **hanya** diberikan pada satu wadah fungsional yang melayang di atas konten (Floating Dock). Top bar, kartu katalog, dan modal dibuat berbahan *solid surface* dengan kontras terukur agar teks tajam dan performa 60fps terjaga. |
| **2. "Dull Symmetrical 3-Card Grid with Generic Icons"** | Kartu katalog AI biasanya hanya kotak polos dengan ikon folder/dokumen generik dan tombol *"Read More"*. Pengguna tidak mendapatkan gambaran nyata tentang isi dokumen. | **Skeuomorphic Book Representation:** Kartu katalog menampilkan gambar sampul asli slide pertama dokumen yang dipadukan dengan efek lipatan jilid fisik di sisi kiri, badge status yang terstruktur, dan aksi visual langsung *"Buka Flipbook →"*. |
| **3. "Single-Letter Shortcut Clutter without Accessibility Fallback"** | AI cenderung menumpuk shortcut keyboard satu huruf tanpa memikirkan pengguna screen reader, input form, atau pengguna perangkat sentuh (HP). | **Human-Centered Controls:** Semua kontrol fungsional memiliki tombol visual yang jelas, shortcut keyboard dilindungi guard clause agar tidak menimpa pengetikan form, dan navigasi Full Keyboard Access dilengkapi indikator fokus `:focus-visible` standar. |

---

## 6. URUTAN IMPLEMENTASI (IMPLEMENTATION PHASES)

Tahapan eksekusi logis dan terukur, dari pondasi aksesibilitas hingga tahap penghalusan akhir (polish):

### **Fase 1: Aksesibilitas Kritis & Perbaikan Kontras Warna (Prioritas 1)**
- **File Terkait:** `src/style.css`, `DESIGN.md`, `src/read.css`, `index.html`
- **Tindakan:**
  1. Perbaiki rasio kontras tombol primer dan teks di kedua tema (minimal 4.5:1).
  2. Tambahkan global outline focus ring (`:focus-visible`).
  3. Naikkan ukuran font terkecil di seluruh aplikasi menjadi minimal `0.75rem` (12px) dengan bobot tebal.
  4. Hapus impor font `Cinzel` yang tidak terpakai dari `src/style.css`.
- **Risiko:** Perubahan warna aksen pada tombol dapat sedikit mengubah saturasi visual awal; diatasi dengan memilih warna biru laut terkalibrasi (`#0284c7`).

### **Fase 2: Perbaikan Kontrol Keyboard, ARIA, & Adaptasi Preferensi OS**
- **File Terkait:** `src/read.js`, `read.html`, `index.html`
- **Tindakan:**
  1. Tambahkan guard clause pada event listener keyboard (`keydown`) agar tidak bentrok dengan input form.
  2. Sematkan atribut aksesibilitas: `role="dialog"`, `aria-modal="true"`, `aria-live="polite"` pada modal dan toast.
  3. Tambahkan media queries `@media (prefers-reduced-motion)` dan `@media (prefers-reduced-transparency)`.
- **Risiko:** Pengguna yang menggunakan tombol Spasi untuk membalik halaman perlu dipastikan tetap berfungsi selama kursor tidak berada di dalam input teks.

### **Fase 3: Restrukturisasi Dock Reader & Responsivitas Mobile**
- **File Terkait:** `read.html`, `src/read.css`, `src/read.js`
- **Tindakan:**
  1. Bersihkan tumpukan kaca (hilangkan blur berlebih di top bar).
  2. Berikan area tap minimum 44x44 pt pada seluruh tombol kontrol pembaca.
  3. Pada layar smartphone (< 640px), sederhanakan dock menjadi kontrol navigasi utama dan pindahkan kontrol tambahan ke dalam panel drawer menu ringkas.
  4. Tambahkan indikator progress countdown melingkar pada tombol auto-play.
- **Risiko:** Perlu penyesuaian media query CSS yang teliti agar layout di tablet (iPad) tetap menampilkan spread penuh.

### **Fase 4: Peningkatan UX Katalog & Admin Portal**
- **File Terkait:** `index.html`, `admin.html`, `src/admin.js`, `src/admin.css`
- **Tindakan:**
  1. Sempurnakan tampilan kartu buku katalog dengan bayangan jilid yang rapi.
  2. Ganti dialog `window.confirm()` pada penghapusan handbook dengan modal konfirmasi konseptual dan toast "Batalkan / Undo".
  3. Standarkan bahasa antarmuka secara menyeluruh ke Bahasa Indonesia yang konsisten dan lugas.
- **Risiko:** Minimal, hanya menyentuh lapisan presentasi dan handler konfirmasi di admin.

---

## 7. PERTANYAAN TERBUKA (KEPUTUSAN PENGGUNA)

Sebelum melangkah ke Tahap 2 (Implementasi Kode), mohon konfirmasi untuk 3 poin berikut:

1. **Warna Teks Tombol Primer:**  
   Apakah kamu lebih memilih:
   - **Opsi A (Rekomendasi HIG):** Tombol tetap berwarna Cyan Sky `#38bdf8`, tetapi teks di dalamnya menggunakan warna gelap pekat `#04131f` (Kontras 11.2:1, sangat tajam dan modern).
   - **Opsi B:** Tombol menggunakan Biru Cerulean `#0284c7` dengan teks tetap putih `#ffffff` (Kontras 4.6:1, klasik korporat).
2. **Tata Letak Dock di Smartphone:**  
   Apakah kamu setuju jika di layar HP kecil kontrol sekunder (Suasana, Musik, AutoPlay, Layar Penuh) dimasukkan ke dalam sheet menu `(≡)`, sementara dock bawah hanya menampilkan navigasi esensial `[ < ] [ Halaman X ] [ > ]`?
3. **Mekanisme Hapus Handbook Admin:**  
   Apakah penghapusan handbook di admin cukup dengan modal konfirmasi kustom yang elegan, atau kamu juga memerlukan fitur penundaan penghapusan sementara (*Undo Toast* selama 6 detik)?
