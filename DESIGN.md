---
version: alpha
name: BNI Handbook Flipbook Design System
description: Official BNI Brand Palette (Teal & Radiant Orange) crafted with Apple Human Interface Guidelines and modern skeuomorphic book realism.
colors:
  primary: "#005E6A"
  primary-hover: "#004852"
  secondary: "#F15A23"
  secondary-hover: "#D94814"
  bg-main: "#F4F8F8"
  bg-surface: "#FFFFFF"
  bg-card: "#FFFFFF"
  bg-card-hover: "#F0F6F7"
  text-main: "#0B1F23"
  text-muted: "#4A5F64"
  text-faint: "#6A8287"
  border: "rgba(11, 31, 35, 0.10)"
  border-hover: "rgba(0, 94, 106, 0.40)"
  border-strong: "#7A8E92"
  success: "#0E7F53"
  warning: "#9A5B00"
  danger: "#C52A2A"
  dock-bg: "rgba(255, 255, 255, 0.90)"
  gold-spine: "rgba(212, 175, 55, 0.85)"
typography:
  display-hero:
    fontFamily: Outfit
    fontSize: 3.5rem
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.03em"
  h1:
    fontFamily: Outfit
    fontSize: 2.25rem
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  h2:
    fontFamily: Outfit
    fontSize: 1.75rem
    fontWeight: 700
    lineHeight: 1.3
  h3:
    fontFamily: Outfit
    fontSize: 1.25rem
    fontWeight: 700
    lineHeight: 1.35
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 0.95rem
    fontWeight: 400
    lineHeight: 1.6
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 0.85rem
    fontWeight: 500
    lineHeight: 1.5
  label-xs:
    fontFamily: Plus Jakarta Sans
    fontSize: 0.72rem
    fontWeight: 700
    letterSpacing: "0.05em"
rounded:
  sm: 6px
  md: 10px
  lg: 16px
  xl: 20px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.full}"
    padding: 12px
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "#ffffff"
    rounded: "{rounded.full}"
    padding: 12px
  button-accent-orange:
    backgroundColor: "{colors.secondary}"
    textColor: "#0B1F23"
    rounded: "{rounded.full}"
    padding: 12px
  dock-control:
    backgroundColor: "{colors.dock-bg}"
    textColor: "{colors.text-main}"
    rounded: "{rounded.full}"
    padding: 8px
  catalog-card:
    backgroundColor: "{colors.bg-surface}"
    textColor: "{colors.text-main}"
    rounded: "{rounded.xl}"
    padding: 20px
---

## Overview

Handbook Flipbook BNI memadukan identitas resmi korporat Bank Negara Indonesia (BNI Teal `#005E6A` dan BNI Radiant Orange `#F15A23`) dengan estetika Apple Human Interface Guidelines (HIG) dan Skeuomorfisme buku fisik 3D. 

Prinsip Utama:
- **Teal (#005E6A / #36C2D1)**: Mewakili struktur, otoritas, navigasi, dan tombol aksi primer.
- **Orange (#F15A23 / #FF7B47)**: Digunakan secara cermat (*sparingly*) untuk aksen status penting, indikator progres pembaca, dan momen sorotan.
- **Taktil Buku Fisik**: Lipatan jilid tengah (*spine crease*), alas buku 3D bertingkat, dan aksen foil emas tetap menjadi panggung utama.

## Colors

### Light Mode ("BNI Clean Paper")
- **Background Utama (`#F4F8F8`):** Off-white sejuk bernuansa teal segar.
- **Surface (`#FFFFFF`):** Permukaan bersih untuk kartu, navbar, dan popover.
- **Text Main (`#0B1F23`):** Tinta hijau-gelap dengan rasio kontras 15.9:1 di atas latar utama.
- **Text Muted (`#4A5F64`):** Kontras 6.3:1 (lulus WCAG AA 4.5:1).
- **BNI Teal (`#005E6A`):** Warna utama, teks putih di atasnya menghasilkan kontras 7.5:1.
- **BNI Orange (`#F15A23`):** Warna aksen, teks gelap `#0B1F23` di atasnya menghasilkan kontras 5.0:1.

### Dark Mode ("BNI Deep Teal")
- **Background Utama (`#061619`):** Hitam kehijauan pekat turunan teal.
- **Surface & Card (`#0C2327` / `#123036`):** Lapisan elevasi bernuansa teal malam.
- **Text Main (`#F1F7F7`):** Putih gading kontras tinggi 17.1:1.
- **Text Muted (`#9DB6BA`):** Kontras 8.7:1.
- **Teal Dicerahkan (`#36C2D1`):** Kontras 8.6:1 untuk kontrol aktif di dark mode.
- **Orange Dicerahkan (`#FF7B47`):** Kontras 7.2:1 untuk aksen penting di dark mode.

## Typography

- **Outfit:** Digunakan secara konsisten untuk display hero, judul section, dan judul buku dengan bobot geometris tebal (`700` - `800`).
- **Plus Jakarta Sans:** Digunakan untuk seluruh body text, badge label, dan tombol navigasi agar memiliki keterbacaan tinggi (*high legibility*) di layar desktop maupun ponsel.

## Layout

- **Landing Catalog Grid:** Menggunakan CSS Grid auto-fill adaptif dengan minimum kolom kartu buku `260px` dan gap `1.75rem`.
- **Book Stage & Spread View:** Menghadirkan tampilan dua halaman berdampingan (*two-page spread*) pada desktop untuk memaksimalkan ukuran teks slide 16:9, serta otomatis berganti menjadi satu halaman responsif pada layar ponsel (< 768px).

## Elevation & Depth

- **Floating Glass Dock:** Mengapung dengan elevasi tinggi (`z-index: 40`), `backdrop-filter: blur(20px)`, dan multi-layer shadow `var(--glass-dock-shadow)`.
- **Alas Buku 3D (`book-base`):** Menghasilkan bayangan kedalaman buku fisik bertingkat yang melebar dinamis saat buku dibuka.

## Shapes

- **Rounded Corners:** Mulai dari `rounded.md` (10px) untuk item kontrol kecil hingga `rounded.xl` (20px) untuk kartu handbook dan modal pop-up.
- **Pill Badges:** Bentuk kapsul penuh (`9999px`) digunakan untuk navigasi dock, tombol CTA utama, dan filter chips.

## Components

- **`button-primary`:** Tombol aksi BNI Teal dengan teks putih (rasio kontras 7.5:1).
- **`button-accent-orange`:** Tombol sorotan BNI Orange dengan teks gelap `#0B1F23` (rasio kontras 5.0:1).
- **`dock-control`:** Tombol navigasi melingkar berlatar semi-transparan dengan respon hover transform scale.
- **`catalog-card`:** Kartu etalase buku dengan preview sampul, lipatan jilid realistis, dan indikator status PIN.

## Do's and Don'ts

### Do's
- Gunakan BNI Teal untuk identitas merek, tombol aksi primer, dan struktur layout.
- Gunakan BNI Orange secara hemat (*sparingly*) untuk highlight penting dan progress bar.
- Pastikan teks di atas BNI Orange selalu menggunakan teks gelap `#0B1F23` agar memenuhi rasio kontras 5.0:1 (WCAG AA).
- Hormati preferensi sistem: sediakan fallback solid untuk `prefers-reduced-transparency`.

### Don'ts
- Jangan menggunakan BNI Orange sebagai warna latar belakang yang luas.
- Jangan menggunakan teks putih `#FFFFFF` di atas BNI Orange `#F15A23` (rasio hanya 3.4:1, gagal WCAG AA).
- Jangan menaruh efek blur kaca (*Liquid Glass*) pada lapisan konten, kartu, atau teks artikel.
