// /api/superadmin/registrations - list, approve, reject, delete admin registrations
// Storage: Vercel Blob db/admin-users.json
import { setCORSHeaders, verifyToken, getTokenFromReq, list, put } from '../_shared.js';

export const config = { api: { bodyParser: { sizeLimit: '1mb' } } };

const ADMIN_USERS_BLOB = 'db/admin-users.json';
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

function requireSuperAdmin(req, res) {
  const token = getTokenFromReq(req) || (req.headers.cookie || '').match(/superadmin_token=([^;]+)/)?.[1];
  const payload = verifyToken(token);
  if (!payload || payload.role !== 'superadmin') {
    res.status(401).json({ error: 'Akses super admin ditolak.', code: 'UNAUTHORIZED' });
    return null;
  }
  return payload;
}

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

  const admin = requireSuperAdmin(req, res);
  if (!admin) return;

  // GET - list all registrations (password stripped)
  if (req.method === 'GET') {
    const users = await readAdminUsers();
    return res.json(users.map(({ password, ...safe }) => safe));
  }

  const targetId = req.query.id || null;
  const bodyAction = req.query.action || null;

  // POST /registrations?id=..&action=approve|reject
  if (req.method === 'POST' && targetId) {
    const action = bodyAction;
    if (action !== 'approve' && action !== 'reject') {
      return res.status(400).json({ error: 'Aksi tidak dikenal.' });
    }
    const status = action === 'approve' ? 'approved' : 'rejected';
    const users = await readAdminUsers();
    const user = users.find((u) => u.id === targetId);
    if (!user) return res.status(404).json({ error: 'Pendaftar tidak ditemukan.' });

    user.status = status;
    user[status + 'At'] = Date.now();
    const saved = await writeAdminUsers(users);
    if (!saved) return res.status(500).json({ error: 'Gagal menyimpan ke database.' });
    return res.json({ success: true, message: `Akun "${user.name}" ${status === 'approved' ? 'disetujui' : 'ditolak'}.` });
  }

  // DELETE /registrations?id=..
  if (req.method === 'DELETE' && targetId) {
    const users = await readAdminUsers();
    const index = users.findIndex((u) => u.id === targetId);
    if (index === -1) return res.status(404).json({ error: 'Pendaftar tidak ditemukan.' });

    const [removed] = users.splice(index, 1);
    const saved = await writeAdminUsers(users);
    if (!saved) return res.status(500).json({ error: 'Gagal menyimpan ke database.' });
    return res.json({ success: true, message: `Akun "${removed.name}" dihapus.` });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
