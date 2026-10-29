// /api/auth/superadmin/logout - clear super admin session (stateless token: client just drops it)
import { setCORSHeaders } from '../../_shared.js';

export default async function handler(req, res) {
  setCORSHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  res.setHeader('Set-Cookie', [
    'superadmin_token=; HttpOnly; SameSite=Lax; Max-Age=0; Path=/'
  ]);
  return res.json({ success: true });
}
