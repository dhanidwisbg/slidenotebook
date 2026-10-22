// Demo Sample Handbook Generator
// Creates realistic, high-resolution sample slides for immediate preview & testing

export function generateSamplePages(themeColor = '#1e293b') {
  const width = 1200;
  const height = 1600; // 3:4 / A4 proportion

  const slidesData = [
    {
      title: 'Sampul Depan',
      tagline: 'EDISI TAHUN 2026',
      headline: 'HANDBOOK BUDAYA & OPERASIONAL',
      subhead: 'Panduan Praktis Kerja Tim, Nilai Inti, dan Desain Sistem Modern',
      accentColor: '#38bdf8',
      type: 'cover'
    },
    {
      title: 'Selamat Datang',
      tagline: 'BAGIAN 01 — SAMBUTAN',
      headline: 'Membangun Karya Berdampak Nyata',
      body: 'Selamat datang di tim! Handbook ini dirancang sebagai kompas harian kita dalam bekerja, berinovasi, dan tumbuh bersama. Kami percaya bahwa kebebasan yang diiringi rasa tanggung jawab tinggi melahirkan karya terbaik.',
      points: [
        'Prinsip keterbukaan dan transparansi dalam setiap diskusi.',
        'Kualitas eksekusi di atas sekadar kecepatan terburu-buru.',
        'Saling mendukung dan menghargai keberagaman cara pandang.'
      ],
      type: 'content'
    },
    {
      title: 'Nilai-Nilai Utama',
      tagline: 'BAGIAN 02 — PRINSIP KERJA',
      headline: '4 Pilar Fondasi Budaya Kita',
      cards: [
        { title: 'Inovasi Berani', desc: 'Tidak takut mencoba ide baru dan belajar cepat dari kegagalan.' },
        { title: 'Kerapian Eksekusi', desc: 'Perhatian detail tinggi dari desain hingga arsitektur kode.' },
        { title: 'Kolaborasi Asinkron', desc: 'Dokumentasi tertulis rapi mengurangi rapat tidak penting.' },
        { title: 'Fokus Pengguna', desc: 'Setiap fitur dibangun untuk memecahkan masalah riil pembaca.' }
      ],
      type: 'values'
    },
    {
      title: 'Standar Desain',
      tagline: 'BAGIAN 03 — IDENTITAS VISUAL',
      headline: 'Harmoni Warna & Tipografi',
      body: 'Pengalaman visual handbook mengutamakan keterbacaan tinggi, tekstur buku fisik yang elegan, serta interaksi responsif di desktop maupun perangkat seluler.',
      stats: [
        { label: 'Rasio Standar', val: 'A-Series / 16:9' },
        { label: 'Resolusi Optimal', val: '1800 px Max' },
        { label: 'Latensi Balik', val: '< 16 ms Smooth' }
      ],
      type: 'design'
    },
    {
      title: 'Ritme & Fleksibilitas',
      tagline: 'BAGIAN 04 — KESEHATAN TIM',
      headline: 'Keseimbangan Kerja & Waktu Istirahat',
      body: 'Kami mendukung jam kerja fleksibel dan produktivitas berorientasi hasil, bukan jumlah jam duduk di depan layar.',
      perks: [
        '🌿 Program Cuti Sehat Mental & Olahraga',
        '📚 Anggaran Buku & Kursus Bulanan',
        '☕ Tunjangan Setup Kerja Ergonomis',
        '🚀 Hackathon Internal & Kreasi Bebas Tiap Kuartal'
      ],
      type: 'wellness'
    },
    {
      title: 'Sampul Belakang',
      tagline: 'AKHIR DOKUMEN',
      headline: 'Terima Kasih Telah Membaca',
      subhead: 'Handbook Flipbook — Tampilan Asli, Rasa Buku Sungguhan.',
      footer: '© 2026 PT Digital Edukasi Mandiri • Versi 1.0',
      type: 'back-cover'
    }
  ];

  return slidesData.map((slide, index) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Draw background
    if (slide.type === 'cover' || slide.type === 'back-cover') {
      // Leather / luxury hardcover gradient
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, '#0f172a');
      grad.addColorStop(0.5, '#1e293b');
      grad.addColorStop(1, '#090d16');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Gold / embossed decorative border
      ctx.strokeStyle = 'rgba(212, 175, 55, 0.45)';
      ctx.lineWidth = 4;
      ctx.strokeRect(50, 50, width - 100, height - 100);

      ctx.strokeStyle = 'rgba(212, 175, 55, 0.25)';
      ctx.lineWidth = 1;
      ctx.strokeRect(60, 60, width - 120, height - 120);

      // Corner ornaments
      const drawCorner = (x, y, flipX, flipY) => {
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(flipX, flipY);
        ctx.strokeStyle = 'rgba(212, 175, 55, 0.7)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, 30);
        ctx.lineTo(0, 0);
        ctx.lineTo(30, 0);
        ctx.stroke();
        ctx.restore();
      };
      drawCorner(75, 75, 1, 1);
      drawCorner(width - 75, 75, -1, 1);
      drawCorner(75, height - 75, 1, -1);
      drawCorner(width - 75, height - 75, -1, -1);

      // Spine fold texture illusion on left for cover, right for back cover
      const spineGrad = ctx.createLinearGradient(
        slide.type === 'cover' ? 0 : width - 60,
        0,
        slide.type === 'cover' ? 60 : width,
        0
      );
      spineGrad.addColorStop(0, 'rgba(0,0,0,0.4)');
      spineGrad.addColorStop(0.5, 'rgba(255,255,255,0.06)');
      spineGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = spineGrad;
      ctx.fillRect(slide.type === 'cover' ? 0 : width - 60, 0, 60, height);

      // Cover Texts
      ctx.fillStyle = '#38bdf8';
      ctx.font = '600 24px system-ui, sans-serif';
      ctx.letterSpacing = '8px';
      ctx.textAlign = 'center';
      ctx.fillText(slide.tagline, width / 2, 420);

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 54px Georgia, serif';
      wrapText(ctx, slide.headline, width / 2, 540, 900, 75);

      // Gold divider
      ctx.strokeStyle = '#e2b342';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(width / 2 - 120, 720);
      ctx.lineTo(width / 2 + 120, 720);
      ctx.stroke();

      ctx.fillStyle = '#cbd5e1';
      ctx.font = 'normal 26px system-ui, sans-serif';
      wrapText(ctx, slide.subhead || '', width / 2, 790, 850, 42);

      if (slide.footer) {
        ctx.fillStyle = '#64748b';
        ctx.font = 'normal 20px system-ui, sans-serif';
        ctx.fillText(slide.footer, width / 2, height - 120);
      }
    } else {
      // Clean, elegant paper page
      const paperGrad = ctx.createLinearGradient(0, 0, width, height);
      paperGrad.addColorStop(0, '#fcfdfd');
      paperGrad.addColorStop(1, '#f4f6f8');
      ctx.fillStyle = paperGrad;
      ctx.fillRect(0, 0, width, height);

      // Inner margin line
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.8)';
      ctx.lineWidth = 1;
      ctx.strokeRect(40, 40, width - 80, height - 80);

      // Header Tagline
      ctx.textAlign = 'left';
      ctx.fillStyle = '#0284c7';
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.letterSpacing = '3px';
      ctx.fillText(slide.tagline, 90, 130);

      // Headline
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 44px Georgia, serif';
      wrapText(ctx, slide.headline, 90, 210, width - 180, 56);

      // Thin divider
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(90, 275);
      ctx.lineTo(240, 275);
      ctx.stroke();

      // Body text
      if (slide.body) {
        ctx.fillStyle = '#334155';
        ctx.font = 'normal 26px system-ui, sans-serif';
        wrapText(ctx, slide.body, 90, 360, width - 180, 42);
      }

      if (slide.points) {
        let y = 560;
        slide.points.forEach((pt, i) => {
          ctx.fillStyle = '#0284c7';
          ctx.beginPath();
          ctx.arc(105, y - 8, 8, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#1e293b';
          ctx.font = '500 24px system-ui, sans-serif';
          wrapText(ctx, pt, 135, y, width - 240, 38);
          y += 120;
        });
      }

      if (slide.cards) {
        let y = 360;
        slide.cards.forEach((c) => {
          ctx.fillStyle = '#ffffff';
          roundRect(ctx, 90, y, width - 180, 110, 14);
          ctx.fill();
          ctx.strokeStyle = '#e2e8f0';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.fillStyle = '#0369a1';
          ctx.font = 'bold 24px system-ui, sans-serif';
          ctx.fillText(c.title, 120, y + 45);

          ctx.fillStyle = '#475569';
          ctx.font = 'normal 20px system-ui, sans-serif';
          ctx.fillText(c.desc, 120, y + 80);

          y += 135;
        });
      }

      if (slide.stats) {
        let x = 90;
        const boxW = (width - 180 - 40) / 3;
        slide.stats.forEach((st) => {
          ctx.fillStyle = '#ffffff';
          roundRect(ctx, x, 560, boxW, 160, 14);
          ctx.fill();
          ctx.strokeStyle = '#cbd5e1';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.fillStyle = '#0284c7';
          ctx.font = 'bold 28px Georgia, serif';
          ctx.textAlign = 'center';
          ctx.fillText(st.val, x + boxW / 2, 630);

          ctx.fillStyle = '#64748b';
          ctx.font = '600 17px system-ui, sans-serif';
          ctx.fillText(st.label, x + boxW / 2, 675);
          ctx.textAlign = 'left';

          x += boxW + 20;
        });
      }

      if (slide.perks) {
        let y = 560;
        slide.perks.forEach((p) => {
          ctx.fillStyle = '#ffffff';
          roundRect(ctx, 90, y, width - 180, 80, 12);
          ctx.fill();
          ctx.strokeStyle = '#e2e8f0';
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.fillStyle = '#1e293b';
          ctx.font = '600 22px system-ui, sans-serif';
          ctx.fillText(p, 125, y + 48);

          y += 100;
        });
      }

      // Page footer indicator
      ctx.fillStyle = '#94a3b8';
      ctx.font = '500 18px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`— Halaman ${index} —`, width / 2, height - 70);
    }

    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

    return {
      id: `sample_page_${index + 1}`,
      title: slide.title,
      originalName: `Slide_${index + 1}_${slide.title.replace(/\s+/g, '_')}.jpg`,
      width,
      height,
      orientation: 'portrait',
      aspectRatio: width / height,
      dataUrl,
      fileSize: Math.round(dataUrl.length * 0.75)
    };
  });
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      ctx.fillText(line, x, y);
      line = words[n] + ' ';
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, y);
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}
