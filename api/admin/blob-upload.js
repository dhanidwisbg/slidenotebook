// /api/admin/blob-upload - Client-direct upload handler for Vercel Blob
// Enables uploading large audio & images directly from browser to Vercel Blob,
// bypassing the 4.5MB Serverless function body limit.
import { setCORSHeaders, requireAdmin, BLOB_TOKEN } from '../_shared.js';
import { handleUpload } from '@vercel/blob/client';

export default async function handler(req, res) {
  setCORSHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const admin = requireAdmin(req, res);
  if (!admin) return;

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!BLOB_TOKEN) {
    return res.status(500).json({ error: 'Storage cloud belum terkonfigurasi (BLOB_READ_WRITE_TOKEN).' });
  }

  try {
    const jsonResponse = await handleUpload({
      body: req.body,
      request: req,
      token: BLOB_TOKEN,
      onBeforeGenerateToken: async (pathname) => {
        return {
          allowedContentTypes: [
            'audio/mpeg',
            'audio/mp3',
            'audio/wav',
            'audio/ogg',
            'audio/aac',
            'audio/mp4',
            'audio/x-m4a',
            'image/jpeg',
            'image/png',
            'image/webp'
          ],
          maximumSizeInBytes: 30 * 1024 * 1024, // 30 MB
          tokenPayload: JSON.stringify({ admin: admin.email })
        };
      },
      onUploadCompleted: async ({ blob }) => {
        console.log('[BlobUpload] Upload direct success:', blob.url);
      }
    });

    return res.status(200).json(jsonResponse);
  } catch (error) {
    console.error('[BlobUpload] Error:', error.message);
    return res.status(400).json({ error: error.message });
  }
}
