// /api/auth/[action].js - single serverless function for all auth actions
// Routes: login | register | logout | me | superadmin/login | superadmin/logout
import { setCORSHeaders, signToken, verifyToken, getTokenFromReq, list, put } from '../_shared.js';
import crypto from 'crypto';

export const config = { api: { bodyParser: { sizeLimit: '1mb' } } };

const ADMIN_USERS_BLOB = 'db/admin-users.json';
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

async function readAdminUsers() {
  if (!BLOB_TOKEN) return [];
  try {
    const result = await list({ prefix: ADMIN_USERS_BLOB, token: BLOB_TOKEN });
    if (!result.blobs || result.blobs.length === 0) return [];
    const res = await fetch(result.blobs[0].url + '?v=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) return [];
    return await res.json();
  } catch (e) {
    console.error('[AdminUsers] Read error:', e.message);
    return [];
  }
}

async function writeAdminUsers(users) {
  if (!BLOB_TOKEN) return false;
  try {
    await put(ADMIN_USERS_BLOB, JSON.stringify(users, null, 2), {
      access: 'public',
      token: BLOB_TOKEN,
      allowOverwrite: true,
      contentType: 'application/json',
      addRandomSuffix: false
    });
    return true;
  } catch (e) {
    console.error('[AdminUsers] Write error:', e.message);
    return false;
  }
}

export default async function handler(req, res) {
  setCORSHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Path-based: /api/auth/login -> action=login. Superadmin sub-path datang
  // sebagai ?sub=login dari rewrites vercel.json (dua segmen tak tertangkap [action])
  const rawPath = req.url.split('?')[0].replace(/^\/api\/auth\/?/, '').replace(/\.js$/, '');
  const pathParts = rawPath.split('/').filter(Boolean);
  const action = req.query.action || pathParts[0];
  const sub = req.query.sub || pathParts[1];

  // ── POST /api/auth/login ─ registered + approved admin (name + password)
  if (action === 'login' && req.method === 'POST') {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(401).json({ error: 'Masukkan nama dan password akun admin Anda.' });
    }
    const users = await readAdminUsers();
    const user = users.find(
      (u) => u.name && u.name.toLowerCase() === String(email).trim().toLowerCase()
    );
    if (!user || user.password !== String(password)) {
      return res.status(401).json({ error: 'Nama atau password salah.' });
    }
    if (user.status === 'pending') {
      return res.status(403).json({ error: 'Akun masih menunggu persetujuan super admin.' });
    }
    if (user.status === 'rejected') {
      return res.status(403).json({ error: 'Akun Anda ditolak super admin.' });
    }
    const sessionUser = { email: user.name, name: user.name, role: 'admin' };
    const token = signToken({ ...sessionUser, iat: Date.now() });
    res.setHeader('Set-Cookie', [
      'admin_token=' + token + '; HttpOnly; SameSite=Lax; Max-Age=' + (7 * 24 * 3600) + '; Path=/'
    ]);
    return res.json({ success: true, token, user: sessionUser });
  }

  // ── POST /api/auth/register ─ admin candidate self-registration
  if (action === 'register' && req.method === 'POST') {
    const { name, password } = req.body || {};
    if (!name || !String(name).trim() || !password || String(password).length < 6) {
      return res.status(400).json({ error: 'Nama wajib diisi dan password minimal 6 karakter.' });
    }
    const users = await readAdminUsers();
    const normalizedName = String(name).trim();
    if (users.some((u) => u.name.toLowerCase() === normalizedName.toLowerCase())) {
      return res.status(409).json({ error: 'Nama tersebut sudah terdaftar.' });
    }
    users.push({
      id: 'adm_' + crypto.randomBytes(6).toString('hex'),
      name: normalizedName,
      password: String(password),
      status: 'pending',
      createdAt: Date.now()
    });
    const saved = await writeAdminUsers(users);
    if (!saved) return res.status(500).json({ error: 'Gagal menyimpan pendaftaran.' });
    return res.status(201).json({
      success: true,
      message: 'Pendaftaran terkirim. Akun menunggu persetujuan super admin.'
    });
  }

  // ── POST /api/auth/superadmin/login
  if (action === 'superadmin' && sub === 'login' && req.method === 'POST') {
    const SUPERADMIN_ID = process.env.SUPERADMIN_ID || 'BNIW01';
    const SUPERADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD || '123123456456';
    const { adminId, password } = req.body || {};
    if (adminId !== SUPERADMIN_ID || password !== SUPERADMIN_PASSWORD) {
      return res.status(401).json({ error: 'ID atau password super admin salah.' });
    }
    const user = { email: SUPERADMIN_ID, name: 'Super Admin', role: 'superadmin' };
    const token = signToken({ ...user, iat: Date.now() });
    res.setHeader('Set-Cookie', [
      'superadmin_token=' + token + '; HttpOnly; SameSite=Lax; Max-Age=' + (7 * 24 * 3600) + '; Path=/'
    ]);
    return res.json({ success: true, token, user });
  }

  // ── POST /api/auth/superadmin/logout
  if (action === 'superadmin' && sub === 'logout' && req.method === 'POST') {
    res.setHeader('Set-Cookie', ['superadmin_token=; HttpOnly; SameSite=Lax; Max-Age=0; Path=/']);
    return res.json({ success: true });
  }

  // ── POST /api/auth/logout
  if (action === 'logout' && req.method === 'POST') {
    res.setHeader('Set-Cookie', ['admin_token=; HttpOnly; SameSite=Lax; Max-Age=0; Path=/']);
    return res.json({ success: true, message: 'Berhasil logout.' });
  }

  // ── GET /api/auth/me
  if (action === 'me' && req.method === 'GET') {
    const token = getTokenFromReq(req);
    const payload = verifyToken(token);
    if (payload && payload.role === 'admin') {
      return res.json({ authenticated: true, user: { email: payload.email, name: payload.name, role: payload.role } });
    }
    return res.json({ authenticated: false });
  }

  return res.status(404).json({ error: 'Auth endpoint tidak ditemukan.' });
}
