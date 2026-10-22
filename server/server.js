import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

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
app.use(express.json({ limit: '60mb' }));
app.use(express.urlencoded({ extended: true, limit: '60mb' }));
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

// ============================================================================
// AUTHENTICATION SYSTEM (Admin Only)
// Default Admin: admin@flipbook.id / admin123
// ============================================================================
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@flipbook.id';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

function requireAdminAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = (authHeader && authHeader.startsWith('Bearer '))
    ? authHeader.slice(7)
    : req.cookies?.admin_token;

  if (!token || !activeSessions.has(token)) {
    return res.status(401).json({
      error: 'Akses ditolak. Anda harus login sebagai admin untuk melakukan operasi ini.',
      code: 'UNAUTHORIZED'
    });
  }

  req.adminUser = activeSessions.get(token);
  next();
}

// POST /api/auth/login
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;

  if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
    const token = crypto.randomBytes(32).toString('hex');
    const user = { email: ADMIN_EMAIL, name: 'Administrator', role: 'admin' };

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
    error: 'Email atau kata sandi admin salah. Periksa kembali akun Anda.'
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
  audioUpload.single('audio')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Gagal mengunggah file audio.' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Tidak ada file audio yang diunggah.' });
    }

    const audioUrl = `/uploads/audio/${req.file.filename}`;
    res.json({
      success: true,
      audioUrl,
      fileName: req.file.originalname,
      fileSize: req.file.size
    });
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
    hasPassword: !!item.readerPassword,
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
  res.json(found);
});

// POST /api/admin/handbooks - Create new handbook
app.post('/api/admin/handbooks', requireAdminAuth, (req, res) => {
  const { title, subtitle, orientation, coverColor, pages, audioUrl, autoplay, initialVolume } = req.body;
  const list = getHandbooks();

  const id = 'hb_' + Date.now();
  const uniqueSlug = 'bk-' + crypto.randomBytes(4).toString('hex');

  const newHandbook = {
    id,
    uniqueSlug,
    title: title || 'Handbook Baru',
    subtitle: subtitle || '',
    orientation: orientation || 'portrait',
    coverColor: coverColor || '#1e293b',
    pages: pages || [],
    audioUrl: audioUrl || null,
    autoplay: autoplay !== false,
    initialVolume: typeof initialVolume === 'number' ? initialVolume : 0.45,
    isPublished: false,
    isActive: true,
    readerPassword: null,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  list.push(newHandbook);
  saveHandbooks(list);

  res.status(201).json(newHandbook);
});

// PUT /api/admin/handbooks/:id - Update handbook (pages, metadata, publication)
app.put('/api/admin/handbooks/:id', requireAdminAuth, (req, res) => {
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
    readerPassword
  } = req.body;

  list[index] = {
    ...existing,
    title: title !== undefined ? title : existing.title,
    subtitle: subtitle !== undefined ? subtitle : existing.subtitle,
    orientation: orientation !== undefined ? orientation : existing.orientation,
    coverColor: coverColor !== undefined ? coverColor : existing.coverColor,
    pages: pages !== undefined ? pages : existing.pages,
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
app.delete('/api/admin/handbooks/:id', requireAdminAuth, (req, res) => {
  let list = getHandbooks();
  const initialLen = list.length;
  list = list.filter((h) => h.id !== req.params.id && h.uniqueSlug !== req.params.id);

  if (list.length === initialLen) {
    return res.status(404).json({ error: 'Handbook tidak ditemukan.' });
  }

  saveHandbooks(list);
  res.json({ success: true, message: 'Handbook berhasil dihapus.' });
});

// ============================================================================
// PUBLIC READER ENDPOINT (Read-Only, Protected from modification)
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

// GET /api/public/handbook/:slugOrId - Public read endpoint
app.get('/api/public/handbook/:id', (req, res) => {
  const list = getHandbooks();
  let handbook = list.find((h) => h.uniqueSlug === req.params.id || h.id === req.params.id);

  // Gracefully fallback to the primary handbook if id is 'default', 'preview', or if single book exists
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

  // Check 4: Password protection
  if (handbook.readerPassword && handbook.readerPassword.trim() !== '') {
    const providedPassword = req.headers['x-reader-password'] || req.query.pwd;
    if (!providedPassword || providedPassword !== handbook.readerPassword) {
      // Do NOT send pages or sensitive data if password is not verified!
      return res.status(200).json({
        passwordRequired: true,
        title: handbook.title,
        subtitle: handbook.subtitle,
        coverColor: handbook.coverColor,
        message: 'Handbook ini dilindungi kata sandi baca.'
      });
    }
  }

  // Safe public payload (strip out admin password and internal tokens)
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

app.listen(PORT, () => {
  console.log(`Backend Server running on http://localhost:${PORT}`);
});
