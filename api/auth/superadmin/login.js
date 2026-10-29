// /api/auth/superadmin/login - Super admin login
// Hardcoded credentials are placeholders; set SUPERADMIN_ID / SUPERADMIN_PASSWORD
// env vars in Vercel for real values.
import { setCORSHeaders, signToken } from '../_shared.js';

export const config = { api: { bodyParser: { sizeLimit: '1mb' } } };

export default async function handler(req, res) {
  setCORSHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

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
