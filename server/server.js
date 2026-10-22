import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { put, del } from '@vercel/blob';

try {
  process.loadEnvFile();
} catch (e) {}

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN || null;
if (BLOB_TOKEN) {
  console.log('[Storage] Vercel Blob Storage active and connected.');
} else {
  console.log('[Storage] Running with local disk storage.');
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Ensure storage directories exist
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const AUDIO_UPLOADS_DIR = path.join(UPLOADS_DIR, 'audio');

[DATA_DIR, UPLOADS_DIR, AUDIO_UPLOADS_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const HANDBOOKS_FILE = path.join(DATA_DIR, 'handbooks.json');
if (!fs.existsSync(HANDBOOKS_FILE)) {
  fs.writeFileSync(HANDBOOKS_FILE, JSON.stringify([], null, 2));
}

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '150mb' }));
app.use(express.urlencoded({ extended: true, limit: '150mb' }));
app.use(cookieParser());
app.use('/uploads', express.static(UPLOADS_DIR));

// In-Memory Active Admin Sessions
const activeSessions = new Map();

// Helper functions for JSON database
function getHandbooks() {
  try {
    const raw = fs.readFileSync(HANDBOOKS_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function saveHandbooks(list) {
  fs.writeFileSync(HANDBOOKS_FILE, JSON.stringify(list, null, 2));
}

// Convert base64 slide images to Vercel Blob URLs or local static files
async function uploadSlideImagesToStorage(handbookId, pages) {
  if (!pages || !Array.isArray(pages)) return pages;

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    // If it's a new slide containing raw base64 dataUrl
    if (page.dataUrl && page.dataUrl.startsWith('data:image/')) {
      const match = page.dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
      if (match) {
        const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
        const buffer = Buffer.from(match[2], 'base64');
        const filename = `pages/${handbookId}/${page.id || `p_${i + 1}_${Date.now()}`}.${ext}`;

        if (BLOB_TOKEN) {
          try {
            const blob = await put(filename, buffer, {
              access: 'public',
              token: BLOB_TOKEN
            });
            page.imageUrl = blob.url;
            delete page.dataUrl; // Free the base64 from database!
          } catch (blobErr) {
            console.error('[Storage] Vercel Blob upload failed, fallback to local file:', blobErr.message);
            saveSlideLocally(handbookId, page, buffer, ext);
          }
        } else {
          saveSlideLocally(handbookId, page, buffer, ext);
        }
      }
    }
  }
  return pages;
}

function saveSlideLocally(handbookId, page, buffer, ext) {
  const hbDir = path.join(UPLOADS_DIR, 'handbooks', handbookId);
  if (!fs.existsSync(hbDir)) fs.mkdirSync(hbDir, { recursive: true });
  const file = `${page.id || `p_${Date.now()}`}.${ext}`;
  fs.writeFileSync(path.join(hbDir, file), buffer);
  page.imageUrl = `/uploads/handbooks/${handbookId}/${file}`;
  delete page.dataUrl;
}

// ============================================================================
// AUTHENTICATION SYSTEM (Admin Only)
// Default Admin: admin@flipbook.id / admin123
// ============================================================================
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@flipbook.id';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const ADMIN_PASSCODE = process.env.ADMIN_PASSCODE || '12345678';

function requireAdminAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = (authHeader && authHeader.startsWith('Bearer '))
    ? authHeader.slice(7)
    : req.cookies?.admin_token;

  if (!token || !activeSessions.has(token)) {
    return res.status(401).json({
      error: 'Akses ditolak. Anda harus memasukkan kode akses admin.',
      code: 'UNAUTHORIZED'
    });
  }

  req.adminUser = activeSessions.get(token);
  next();
}

// POST /api/auth/login
app.post('/api/auth/login', (req, res) => {
  const { passcode, email, password } = req.body;

  // Accept passcode 12345678 or legacy credentials
  if (
    passcode === ADMIN_PASSCODE ||
    passcode === '12345678' ||
    (email === ADMIN_EMAIL && password === ADMIN_PASSWORD)
  ) {
    const token = crypto.randomBytes(32).toString('hex');
    const user = { email: 'admin@flipbook.id', name: 'Administrator', role: 'admin' };

    activeSessions.set(token, user);
    res.cookie('admin_token', token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: 'lax'
    });

    return res.json({
      success: true,
      token,
      user
    });
  }

  return res.status(401).json({
    error: 'Kode akses admin salah. Silakan masukkan kode 12345678.'
  });
});

// POST /api/auth/logout
app.post('/api/auth/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = (authHeader && authHeader.startsWith('Bearer '))
    ? authHeader.slice(7)
    : req.cookies?.admin_token;

  if (token) activeSessions.delete(token);
  res.clearCookie('admin_token');
  res.json({ success: true, message: 'Berhasil logout.' });
});

// GET /api/auth/me
app.get('/api/auth/me', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = (authHeader && authHeader.startsWith('Bearer '))
    ? authHeader.slice(7)
    : req.cookies?.admin_token;

  if (token && activeSessions.has(token)) {
    return res.json({ authenticated: true, user: activeSessions.get(token) });
  }
  res.json({ authenticated: false });
});

// ============================================================================
// AUDIO UPLOAD (Admin Only - Max 12 MB)
// ============================================================================
const audioStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, AUDIO_UPLOADS_DIR),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `audio-${uniqueSuffix}${ext}`);
  }
});

const audioUpload = multer({
  storage: audioStorage,
  limits: { fileSize: 12 * 1024 * 1024 }, // 12 MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/') || /\.(mp3|wav|ogg|aac|m4a)$/i.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Format file audio tidak valid. Harap unggah MP3, WAV, OGG, atau M4A.'));
    }
  }
});

app.post('/api/admin/upload-audio', requireAdminAuth, (req, res) => {
  audioUpload.single('audio')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Gagal mengunggah file audio.' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Tidak ada file audio yang diunggah.' });
    }

    let audioUrl = `/uploads/audio/${req.file.filename}`;

    // Upload to Vercel Blob if active
    if (BLOB_TOKEN) {
      try {
        const fileBuffer = fs.readFileSync(req.file.path);
        const blob = await put(`audio/${Date.now()}-${req.file.originalname}`, fileBuffer, {
          access: 'public',
          token: BLOB_TOKEN
        });
        audioUrl = blob.url;
        // Clean up temporary local upload
        try { fs.unlinkSync(req.file.path); } catch (e) {}
      } catch (blobErr) {
        console.warn('[Storage] Vercel Blob audio upload failed, using local file:', blobErr.message);
      }
    }

    res.json({
      success: true,
      audioUrl,
      fileName: req.file.originalname,
      fileSize: req.file.size
    });
  });
});

// ============================================================================
// SINGLE IMAGE UPLOAD (Admin Only - Per-page upload to Vercel Blob)
// Called one image at a time from client to stay under serverless size limits
// ============================================================================
const imageStorage = multer.memoryStorage(); // use memory for immediate re-upload
const imageUpload = multer({
  storage: imageStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB per image
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Hanya file gambar yang diizinkan.'));
    }
  }
});

app.post('/api/admin/upload-image', requireAdminAuth, (req, res) => {
  imageUpload.single('image')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Gagal mengunggah gambar.' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Tidak ada file gambar yang diunggah.' });
    }

    const handbookId = req.body.handbookId;
    const pageId = req.body.pageId;

    if (!handbookId || !pageId) {
      return res.status(400).json({ error: 'handbookId dan pageId diperlukan.' });
    }

    const ext = path.extname(req.file.originalname).toLowerCase().replace('.', '') || 'jpg';
    let imageUrl;

    if (BLOB_TOKEN) {
      // Upload to Vercel Blob
      try {
        const filename = `pages/${handbookId}/${pageId}.${ext}`;
        const blob = await put(filename, req.file.buffer, {
          access: 'public',
          token: BLOB_TOKEN,
          contentType: req.file.mimetype,
          allowOverwrite: true,
          addRandomSuffix: false
        });
        imageUrl = blob.url;
      } catch (blobErr) {
        console.warn('[Storage] Vercel Blob image upload failed, fallback to local:', blobErr.message);
        // Fallback: save locally
        const hbDir = path.join(UPLOADS_DIR, 'handbooks', handbookId);
        if (!fs.existsSync(hbDir)) fs.mkdirSync(hbDir, { recursive: true });
        const filename = `${pageId}.${ext}`;
        fs.writeFileSync(path.join(hbDir, filename), req.file.buffer);
        imageUrl = `/uploads/handbooks/${handbookId}/${filename}`;
      }
    } else {
      // Local storage
      const hbDir = path.join(UPLOADS_DIR, 'handbooks', handbookId);
      if (!fs.existsSync(hbDir)) fs.mkdirSync(hbDir, { recursive: true });
      const filename = `${pageId}.${ext}`;
      fs.writeFileSync(path.join(hbDir, filename), req.file.buffer);
      imageUrl = `/uploads/handbooks/${handbookId}/${filename}`;
    }

    res.json({ success: true, imageUrl, pathname: `pages/${handbookId}/${pageId}.${ext}` });
  });
});



// ============================================================================
// PPT / PPTX CONVERSION (Admin Only - Native Server Conversion to PDF)
// ============================================================================
const pptUploadsDir = path.join(UPLOADS_DIR, 'ppt');
if (!fs.existsSync(pptUploadsDir)) {
  fs.mkdirSync(pptUploadsDir, { recursive: true });
}

const pptStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, pptUploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `ppt-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  }
});

const pptUpload = multer({
  storage: pptStorage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100 MB max for PPT
});

import { spawn } from 'child_process';

app.post('/api/admin/convert-pptx', requireAdminAuth, (req, res) => {
  pptUpload.single('file')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Gagal mengunggah file PowerPoint.' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Tidak ada file PowerPoint yang diterima.' });
    }

    const inputPath = req.file.path;
    const outputPdfFilename = `converted-${Date.now()}-${Math.round(Math.random() * 1e9)}.pdf`;
    const outputPath = path.join(UPLOADS_DIR, outputPdfFilename);
    const pythonScript = path.join(__dirname, 'convert_ppt.py');

    // Run Python conversion
    const pythonCmd = fs.existsSync('C:\\Python313\\python.exe') ? 'C:\\Python313\\python.exe' : 'python';
    const proc = spawn(pythonCmd, [pythonScript, inputPath, outputPath]);

    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.on('close', (code) => {
      // Clean up uploaded PPT file
      try { fs.unlinkSync(inputPath); } catch (e) {}

      if (code === 0 && fs.existsSync(outputPath)) {
        return res.json({
          success: true,
          pdfUrl: `/uploads/${outputPdfFilename}`,
          originalName: req.file.originalname
        });
      } else {
        return res.status(500).json({
          error: `Gagal mengonversi PowerPoint: ${stderr || 'Kesalahan saat membuka PowerPoint.'}`,
          needManualExport: true
        });
      }
    });
  });
});

// ============================================================================
// ADMIN HANDBOOK MANAGEMENT (Strictly Admin Only)
// ============================================================================

// GET /api/admin/handbooks - List all handbooks
app.get('/api/admin/handbooks', requireAdminAuth, (req, res) => {
  const list = getHandbooks();
  // Return summary list without heavy page image data for speed
  const summaries = list.map((item) => ({
    id: item.id,
    uniqueSlug: item.uniqueSlug,
    title: item.title,
    subtitle: item.subtitle,
    orientation: item.orientation,
    coverColor: item.coverColor,
    pageCount: item.pages ? item.pages.length : 0,
    isPublished: !!item.isPublished,
    isActive: item.isActive !== false,
    readerPassword: item.readerPassword || null,
    hasPassword: !!(item.readerPassword && item.readerPassword.trim() !== ''),
    accessKey: item.accessKey || `key_${item.uniqueSlug || item.id}`,
    updatedAt: item.updatedAt || item.createdAt
  }));
  res.json(summaries);
});

// GET /api/admin/handbooks/:id - Get single handbook full details
app.get('/api/admin/handbooks/:id', requireAdminAuth, (req, res) => {
  const list = getHandbooks();
  const found = list.find((h) => h.id === req.params.id || h.uniqueSlug === req.params.id);
  if (!found) {
    return res.status(404).json({ error: 'Handbook tidak ditemukan.' });
  }
  if (!found.accessKey) {
    found.accessKey = `key_${found.uniqueSlug || found.id}`;
  }
  res.json(found);
});

// POST /api/admin/handbooks - Create new handbook
app.post('/api/admin/handbooks', requireAdminAuth, async (req, res) => {
  const { title, subtitle, orientation, coverColor, pages, audioUrl, autoplay, initialVolume, readerPassword } = req.body;
  const list = getHandbooks();

  const id = 'hb_' + Date.now();
  const uniqueSlug = 'bk-' + crypto.randomBytes(4).toString('hex');
  const accessKey = 'key_' + crypto.randomBytes(6).toString('hex');

  // Convert raw base64 pages to storage URLs (Vercel Blob / Local Disk)
  const storedPages = await uploadSlideImagesToStorage(id, pages || []);

  const newHandbook = {
    id,
    uniqueSlug,
    accessKey,
    title: title || 'Handbook Baru',
    subtitle: subtitle || '',
    orientation: orientation || 'portrait',
    coverColor: coverColor || '#1e293b',
    pages: storedPages,
    audioUrl: audioUrl || null,
    autoplay: autoplay !== false,
    initialVolume: typeof initialVolume === 'number' ? initialVolume : 0.45,
    isPublished: true,
    isActive: true,
    readerPassword: readerPassword || null,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  list.unshift(newHandbook);
  saveHandbooks(list);

  res.status(201).json(newHandbook);
});

// PUT /api/admin/handbooks/:id - Update handbook (pages, metadata, publication)
app.put('/api/admin/handbooks/:id', requireAdminAuth, async (req, res) => {
  const list = getHandbooks();
  const index = list.findIndex((h) => h.id === req.params.id || h.uniqueSlug === req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: 'Handbook tidak ditemukan.' });
  }

  const existing = list[index];
  const {
    title,
    subtitle,
    orientation,
    coverColor,
    pages,
    audioUrl,
    autoplay,
    initialVolume,
    isPublished,
    isActive,
    readerPassword,
    accessKey
  } = req.body;

  // Convert any newly added raw base64 pages to storage URLs (Vercel Blob / Local Disk)
  let storedPages = existing.pages;
  if (pages !== undefined) {
    storedPages = await uploadSlideImagesToStorage(existing.id, pages);
  }

  list[index] = {
    ...existing,
    accessKey: accessKey || existing.accessKey || `key_${existing.uniqueSlug || existing.id}`,
    title: title !== undefined ? title : existing.title,
    subtitle: subtitle !== undefined ? subtitle : existing.subtitle,
    orientation: orientation !== undefined ? orientation : existing.orientation,
    coverColor: coverColor !== undefined ? coverColor : existing.coverColor,
    pages: storedPages,
    audioUrl: audioUrl !== undefined ? audioUrl : existing.audioUrl,
    autoplay: autoplay !== undefined ? autoplay : existing.autoplay,
    initialVolume: initialVolume !== undefined ? initialVolume : existing.initialVolume,
    isPublished: isPublished !== undefined ? isPublished : existing.isPublished,
    isActive: isActive !== undefined ? isActive : existing.isActive,
    readerPassword: readerPassword !== undefined ? readerPassword : existing.readerPassword,
    updatedAt: Date.now()
  };

  saveHandbooks(list);
  res.json(list[index]);
});

// DELETE /api/admin/handbooks/:id - Delete handbook
app.delete('/api/admin/handbooks/:id', requireAdminAuth, async (req, res) => {
  let list = getHandbooks();
  const found = list.find((h) => h.id === req.params.id || h.uniqueSlug === req.params.id);

  if (!found) {
    return res.status(404).json({ error: 'Handbook tidak ditemukan.' });
  }

  // Cleanup Vercel Blob files if any
  if (BLOB_TOKEN && found.pages) {
    const blobUrls = found.pages
      .map((p) => p.imageUrl)
      .filter((u) => u && u.includes('blob.vercel-storage.com'));
    if (found.audioUrl && found.audioUrl.includes('blob.vercel-storage.com')) {
      blobUrls.push(found.audioUrl);
    }
    if (blobUrls.length > 0) {
      del(blobUrls, { token: BLOB_TOKEN }).catch((e) =>
        console.warn('[Storage] Blob delete cleanup warning:', e.message)
      );
    }
  }

  // Cleanup local files if any
  const localHbDir = path.join(UPLOADS_DIR, 'handbooks', found.id);
  if (fs.existsSync(localHbDir)) {
    try {
      fs.rmSync(localHbDir, { recursive: true, force: true });
    } catch (e) {}
  }

  list = list.filter((h) => h.id !== req.params.id && h.uniqueSlug !== req.params.id);
  saveHandbooks(list);

  res.json({ success: true, message: 'Handbook dan file terkait berhasil dihapus.' });
});

// ============================================================================
// PUBLIC READER ENDPOINTS (Read-Only, Protected from modification)
// ============================================================================

// Strict check: Block any write attempts to public
app.use('/api/public', (req, res, next) => {
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    return res.status(405).json({
      error: 'Operasi tulis tidak diizinkan di rute pembaca.',
      code: 'METHOD_NOT_ALLOWED'
    });
  }
  next();
});

// GET /api/public/handbooks - Public catalog list (NO SLIDE IMAGES EXPOSED)
app.get('/api/public/handbooks', (req, res) => {
  const list = getHandbooks();
  const catalog = list
    .filter((h) => h.isPublished && h.isActive !== false)
    .map((h) => ({
      id: h.id,
      uniqueSlug: h.uniqueSlug,
      title: h.title,
      subtitle: h.subtitle,
      orientation: h.orientation,
      coverColor: h.coverColor,
      pageCount: h.pages ? h.pages.length : 0,
      hasPassword: !!(h.readerPassword && h.readerPassword.trim() !== ''),
      updatedAt: h.updatedAt || h.createdAt
    }));
  res.json(catalog);
});

// GET /api/public/handbook/:slugOrId - Public read endpoint
app.get('/api/public/handbook/:id', (req, res) => {
  const list = getHandbooks();
  let handbook = list.find((h) => h.uniqueSlug === req.params.id || h.id === req.params.id);

  // Fallback to first published if 'default' requested
  if (!handbook && (req.params.id === 'default' || req.params.id === 'preview' || list.length === 1)) {
    handbook = list.find((h) => h.isPublished) || list[0];
  }

  // Check 1: Handbook exists
  if (!handbook) {
    return res.status(404).json({
      error: 'not_found',
      message: 'Handbook tidak ditemukan atau link sudah tidak berlaku.'
    });
  }

  // Check 2: Handbook is published
  if (!handbook.isPublished) {
    return res.status(403).json({
      error: 'unpublished',
      message: 'Handbook ini belum dipublikasikan oleh pemiliknya.'
    });
  }

  // Check 3: Link is active (not disabled)
  if (handbook.isActive === false) {
    return res.status(403).json({
      error: 'disabled',
      message: 'Handbook ini telah dinonaktifkan oleh administrator.'
    });
  }

  // Check 4: PIN and Direct Access Key Verification
  if (handbook.readerPassword && handbook.readerPassword.trim() !== '') {
    const providedKey = req.query.key || req.headers['x-access-key'];
    const providedPin = req.headers['x-reader-password'] || req.query.pwd || req.query.pin;

    // DIRECT LINK BYPASS: If direct key matches, allow immediate reading without PIN!
    const isDirectKeyValid =
      providedKey &&
      (providedKey === handbook.accessKey || providedKey === handbook.uniqueSlug);
    const isPinValid = providedPin && providedPin === handbook.readerPassword;

    if (!isDirectKeyValid && !isPinValid) {
      // Do NOT send pages if neither direct key nor PIN is verified!
      return res.status(200).json({
        passwordRequired: true,
        title: handbook.title,
        subtitle: handbook.subtitle,
        coverColor: handbook.coverColor,
        message: 'Handbook ini dilindungi PIN oleh administrator.'
      });
    }
  }

  // Safe public payload
  res.json({
    id: handbook.id,
    uniqueSlug: handbook.uniqueSlug,
    title: handbook.title,
    subtitle: handbook.subtitle,
    orientation: handbook.orientation,
    coverColor: handbook.coverColor,
    pages: handbook.pages,
    audioUrl: handbook.audioUrl,
    autoplay: handbook.autoplay,
    initialVolume: handbook.initialVolume,
    updatedAt: handbook.updatedAt
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Ukuran payload melebihi batas server (150 MB).' });
  }
  console.error('Server Internal Error:', err);
  res.status(500).json({ error: err.message || 'Kesalahan internal server.' });
});

app.listen(PORT, () => {
  console.log(`Backend Server running on http://localhost:${PORT}`);
});
