// Shared utilities for Vercel API routes
import { put, list, del, head } from '@vercel/blob';
import crypto from 'crypto';

export const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN || null;

const DB_BLOB_PATH = 'db/handbooks.json';

// ─── CORS Helper ──────────────────────────────────────────────────────────────
export function setCORSHeaders(res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,PUT,DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Reader-Password, X-Access-Key');
}

// ─── Stateless HMAC-signed token auth ─────────────────────────────────────────
// Survives across serverless invocations (no in-memory session store needed)
const SECRET = process.env.SESSION_SECRET || 'hfb_secret_2024_static';

export function signToken(payload) {
  const data = JSON.stringify(payload);
  const b64 = Buffer.from(data).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(b64).digest('base64url');
  return b64 + '.' + sig;
}

export function verifyToken(token) {
  if (!token) return null;
  try {
    const dot = token.lastIndexOf('.');
    if (dot === -1) return null;
    const b64 = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    const expected = crypto.createHmac('sha256', SECRET).update(b64).digest('base64url');
    if (sig !== expected) return null;
    return JSON.parse(Buffer.from(b64, 'base64url').toString());
  } catch {
    return null;
  }
}

export function getTokenFromReq(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  const cookieHeader = req.headers.cookie || '';
  const match = cookieHeader.match(/(?:admin_token|superadmin_token)=([^;]+)/);
  return match ? match[1] : null;
}

export function requireAdmin(req, res) {
  const token = getTokenFromReq(req);
  const payload = verifyToken(token);
  if (!payload || payload.role !== 'admin') {
    res.status(401).json({ error: 'Akses ditolak. Login sebagai admin terlebih dahulu.', code: 'UNAUTHORIZED' });
    return null;
  }
  return payload;
}

// ─── Vercel Blob JSON Database ─────────────────────────────────────────────────
// Stores all handbooks as a single db/handbooks.json blob.
// Uses list() to find the blob URL, then fetches with cache-busting.

export async function readHandbooksDB() {
  if (!BLOB_TOKEN) return [];
  try {
    // list() returns the blob metadata including its CDN URL
    const result = await list({ prefix: DB_BLOB_PATH, token: BLOB_TOKEN });
    if (!result.blobs || result.blobs.length === 0) return [];

    // Use the blob URL (stable per pathname on Vercel Blob)
    // Add cache-buster to bypass CDN cache and always get latest version
    const blobUrl = result.blobs[0].url;
    const res = await fetch(blobUrl + '?v=' + Date.now(), {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' }
    });
    if (!res.ok) return [];
    return await res.json();
  } catch (e) {
    console.error('[DB] Read error:', e.message);
    return [];
  }
}

export async function writeHandbooksDB(handbooks) {
  if (!BLOB_TOKEN) return false;
  try {
    const result = await put(DB_BLOB_PATH, JSON.stringify(handbooks, null, 2), {
      access: 'public',
      token: BLOB_TOKEN,
      allowOverwrite: true,
      contentType: 'application/json',
      addRandomSuffix: false
    });
    console.log('[DB] Written to:', result.url);
    return true;
  } catch (e) {
    console.error('[DB] Write error:', e.message);
    return false;
  }
}

// ─── Server-side slide image upload (fallback if client-side upload fails) ────
export async function uploadSlideImages(handbookId, pages) {
  if (!pages || !Array.isArray(pages)) return pages;
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    if (page.dataUrl && page.dataUrl.startsWith('data:image/')) {
      const match = page.dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
      if (match && BLOB_TOKEN) {
        const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
        const buffer = Buffer.from(match[2], 'base64');
        const pid = page.id || ('p_' + (i + 1) + '_' + Date.now());
        const filename = 'pages/' + handbookId + '/' + pid + '.' + ext;
        try {
          const blob = await put(filename, buffer, {
            access: 'public',
            token: BLOB_TOKEN,
            contentType: 'image/' + match[1],
            allowOverwrite: true,
            addRandomSuffix: false
          });
          page.imageUrl = blob.url;
          delete page.dataUrl;
        } catch (err) {
          console.error('[Blob] Server image upload failed page ' + i + ': ' + err.message);
        }
      }
    }
  }
  return pages;
}

// ─── Cleanup Blob files by URL ─────────────────────────────────────────────────
export async function deleteBlobFiles(urls) {
  if (!BLOB_TOKEN || !urls || urls.length === 0) return;
  const blobUrls = urls.filter(function(u) { return u && u.includes('blob.vercel-storage.com'); });
  if (blobUrls.length > 0) {
    try { await del(blobUrls, { token: BLOB_TOKEN }); } catch (e) {
      console.warn('[Blob] Delete warning:', e.message);
    }
  }
}
