// /api/auth/login - Admin login
import { setCORSHeaders, signToken, ADMIN_PASSCODE, ADMIN_EMAIL, ADMIN_PASSWORD } from '../_shared.js';

export default async function handler(req, res) {
  setCORSHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { passcode, email, password } = req.body || {};

  const validPasscode = passcode === ADMIN_PASSCODE || passcode === '12345678';
  const validCredentials = email === ADMIN_EMAIL && password === ADMIN_PASSWORD;

  if (validPasscode || validCredentials) {
    const user = { email: 'admin@flipbook.id', name: 'Administrator', role: 'admin' };
    const token = signToken({ ...user, iat: Date.now() });

    res.setHeader('Set-Cookie', [
      'admin_token=' + token + '; HttpOnly; SameSite=Lax; Max-Age=' + (7 * 24 * 3600) + '; Path=/'
    ]);
    return res.json({ success: true, token, user });
  }

  return res.status(401).json({ error: 'Kode akses admin salah. Silakan masukkan kode 12345678.' });
}
