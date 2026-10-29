// /api/auth/login - Admin login (registered + approved name + password only)
import { setCORSHeaders, signToken, list } from '../_shared.js';

const ADMIN_USERS_BLOB = 'db/admin-users.json';

export const config = { api: { bodyParser: { sizeLimit: '1mb' } } };

async function readAdminUsers() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return [];
  try {
    const result = await list({ prefix: ADMIN_USERS_BLOB, token: process.env.BLOB_READ_WRITE_TOKEN });
    if (!result.blobs || result.blobs.length === 0) return [];
    const res = await fetch(result.blobs[0].url + '?v=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) return [];
    return await res.json();
  } catch (e) {
    console.error('[AdminUsers] Read error:', e.message);
    return [];
  }
}

export default async function handler(req, res) {
  setCORSHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

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
