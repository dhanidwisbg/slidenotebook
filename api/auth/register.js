// /api/auth/register - admin candidate self-registration (pending until approved)
// Storage: Vercel Blob db/admin-users.json
import { setCORSHeaders, list, put } from '../_shared.js';
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
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

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
