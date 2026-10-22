// /api/admin/blob-token - Generate a client upload token for Vercel Blob
import { setCORSHeaders, requireAdmin, BLOB_TOKEN } from '../_shared.js';
import { generateClientTokenFromReadWriteToken } from '@vercel/blob/client';

export default async function handler(req, res) {
  setCORSHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const admin = requireAdmin(req, res);
  if (!admin) return;

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!BLOB_TOKEN) {
    return res.status(500).json({ error: 'Vercel Blob tidak dikonfigurasi di server.' });
  }

  const { pathname, contentType } = req.body || {};
  if (!pathname) {
    return res.status(400).json({ error: 'pathname diperlukan.' });
  }

  try {
    const clientToken = await generateClientTokenFromReadWriteToken({
      token: BLOB_TOKEN,
      pathname,
      onUploadCompleted: {
        callbackUrl: process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL + '/api/admin/blob-confirm' : null,
        tokenPayload: JSON.stringify({ admin: admin.email })
      }
    });
    return res.json({ token: clientToken, pathname });
  } catch (err) {
    console.error('[BlobToken]', err.message);
    return res.status(500).json({ error: 'Gagal generate upload token: ' + err.message });
  }
}
