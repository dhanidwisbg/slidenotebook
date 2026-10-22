// /api/admin/upload-image - Upload single page image to Vercel Blob
// Called per-image from browser to stay under 4.5MB serverless limit
import { setCORSHeaders, requireAdmin, BLOB_TOKEN } from '../_shared.js';
import { put } from '@vercel/blob';

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  setCORSHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const admin = requireAdmin(req, res);
  if (!admin) return;

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!BLOB_TOKEN) {
    return res.status(500).json({ error: 'Vercel Blob tidak dikonfigurasi.' });
  }

  const contentType = req.headers['content-type'] || '';

  if (!contentType.includes('multipart/form-data')) {
    return res.status(400).json({ error: 'Content-Type must be multipart/form-data' });
  }

  // Parse boundary
  const boundaryMatch = contentType.match(/boundary=([^;]+)/);
  if (!boundaryMatch) return res.status(400).json({ error: 'Missing multipart boundary' });
  const boundary = '--' + boundaryMatch[1].trim();

  // Read body
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks);
  const boundaryBuf = Buffer.from(boundary, 'binary');

  // Simple multipart parser
  let pos = 0;
  let filePart = null;
  let handbookId = null;
  let pageId = null;
  let imgExt = 'jpg';

  while (pos < body.length) {
    const boundaryIdx = body.indexOf(boundaryBuf, pos);
    if (boundaryIdx === -1) break;
    pos = boundaryIdx + boundaryBuf.length;
    if (body[pos] === 45 && body[pos + 1] === 45) break; // end boundary
    if (body[pos] === 13) pos += 2; // \r\n

    const headerEnd = body.indexOf(Buffer.from('\r\n\r\n'), pos);
    if (headerEnd === -1) break;
    const headers = body.slice(pos, headerEnd).toString();
    pos = headerEnd + 4;

    const nextBoundaryBuf = Buffer.from('\r\n' + boundary);
    const nextBoundary = body.indexOf(nextBoundaryBuf, pos);
    const partData = nextBoundary !== -1 ? body.slice(pos, nextBoundary) : body.slice(pos);
    pos = nextBoundary !== -1 ? nextBoundary + 2 : body.length;

    const nameMatch = headers.match(/name="([^"]+)"/);
    const filenameMatch = headers.match(/filename="([^"]+)"/);
    const partName = nameMatch ? nameMatch[1] : '';

    if (partName === 'image' && filenameMatch) {
      filePart = partData;
      const fname = filenameMatch[1];
      imgExt = fname.split('.').pop().toLowerCase() || 'jpg';
    } else if (partName === 'handbookId') {
      handbookId = partData.toString().trim();
    } else if (partName === 'pageId') {
      pageId = partData.toString().trim();
    }
  }

  if (!filePart || !handbookId || !pageId) {
    return res.status(400).json({ error: 'Missing required fields: image, handbookId, pageId' });
  }

  if (filePart.length > 5 * 1024 * 1024) {
    return res.status(413).json({ error: 'Image exceeds 5MB limit per page.' });
  }

  const mimeType = imgExt === 'png' ? 'image/png' : imgExt === 'webp' ? 'image/webp' : 'image/jpeg';
  const filename = 'pages/' + handbookId + '/' + pageId + '.' + imgExt;

  try {
    const blob = await put(filename, filePart, {
      access: 'public',
      token: BLOB_TOKEN,
      contentType: mimeType,
      allowOverwrite: true
    });
    return res.json({ success: true, imageUrl: blob.url, pathname: blob.pathname });
  } catch (err) {
    console.error('[upload-image] Blob put failed:', err.message);
    return res.status(500).json({ error: 'Gagal upload gambar: ' + err.message });
  }
}
