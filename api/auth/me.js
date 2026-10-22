// /api/auth/me
import { setCORSHeaders, getTokenFromReq, verifyToken } from '../_shared.js';

export default async function handler(req, res) {
  setCORSHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  const token = getTokenFromReq(req);
  const payload = verifyToken(token);
  if (payload && payload.role === 'admin') {
    return res.json({ authenticated: true, user: { email: payload.email, name: payload.name, role: payload.role } });
  }
  return res.json({ authenticated: false });
}
