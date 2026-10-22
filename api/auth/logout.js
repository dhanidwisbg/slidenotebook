// /api/auth/logout
import { setCORSHeaders } from '../_shared.js';

export default async function handler(req, res) {
  setCORSHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  res.setHeader('Set-Cookie', ['admin_token=; HttpOnly; Max-Age=0; Path=/']);
  return res.json({ success: true, message: 'Berhasil logout.' });
}
