// /api/admin/upload-audio - Upload audio file to Vercel Blob
import { setCORSHeaders, requireAdmin, BLOB_TOKEN } from '../_shared.js';
import { put } from '@vercel/blob';

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  setCORSHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const admin = requireAdmin(req, res);
  if (!admin) return;

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Read raw body
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks);

  const contentType = req.headers['content-type'] || '';
  if (!contentType.includes('multipart/form-data')) {
    return res.status(400).json({ error: 'Content-Type must be multipart/form-data' });
  }

  // Extract boundary safely, handling possible surrounding quotes
  const boundaryMatch = contentType.match(/boundary=([^;]+)/);
  if (!boundaryMatch) return res.status(400).json({ error: 'Missing multipart boundary' });
  const rawBoundary = boundaryMatch[1].trim().replace(/^["']|["']$/g, '');
  const boundary = '--' + rawBoundary;

  const parts = [];
  const boundaryBuf = Buffer.from(boundary, 'binary');

  let pos = 0;
  while (pos < body.length) {
    const boundaryIdx = body.indexOf(boundaryBuf, pos);
    if (boundaryIdx === -1) break;
    pos = boundaryIdx + boundaryBuf.length;
    if (body[pos] === 45 && body[pos + 1] === 45) break; // --
    if (body[pos] === 13) pos += 2; // \r\n

    // Read headers
    const headerEnd = body.indexOf(Buffer.from('\r\n\r\n'), pos);
    if (headerEnd === -1) break;
    const headers = body.slice(pos, headerEnd).toString();
    pos = headerEnd + 4;

    // Find next boundary
    const nextBoundaryBuf = Buffer.from('\r\n' + boundary);
    const nextBoundary = body.indexOf(nextBoundaryBuf, pos);
    const fileData = nextBoundary !== -1 ? body.slice(pos, nextBoundary) : body.slice(pos);

    const nameMatch = headers.match(/name="([^"]+)"/);
    const filenameMatch = headers.match(/filename="([^"]+)"/);
    parts.push({
      name: nameMatch ? nameMatch[1] : '',
      filename: filenameMatch ? filenameMatch[1] : '',
      data: fileData,
      headers
    });

    pos = nextBoundary !== -1 ? nextBoundary + 2 : body.length;
  }

  const filePart = parts.find(function(p) { return p.name === 'audio' && p.filename; });
  if (!filePart) {
    return res.status(400).json({ error: 'Tidak ada file audio yang diunggah.' });
  }

  const filename = filePart.filename;
  const ext = filename.split('.').pop().toLowerCase();
  const allowedExts = ['mp3', 'wav', 'ogg', 'aac', 'm4a', 'mp4'];
  if (!allowedExts.includes(ext)) {
    return res.status(400).json({ error: 'Format file audio tidak valid. Harap unggah MP3, WAV, OGG, atau M4A.' });
  }

  if (filePart.data.length > 25 * 1024 * 1024) {
    return res.status(400).json({ error: 'File audio melebihi batas 25 MB.' });
  }

  const mimeMap = {
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    aac: 'audio/aac',
    m4a: 'audio/mp4',
    mp4: 'audio/mp4'
  };
  const mimeType = mimeMap[ext] || ('audio/' + ext);
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');

  let audioUrl;
  if (BLOB_TOKEN) {
    try {
      const blob = await put('audio/' + Date.now() + '-' + safeName, filePart.data, {
        access: 'public',
        token: BLOB_TOKEN,
        contentType: mimeType,
        allowOverwrite: true
      });
      audioUrl = blob.url;
    } catch (e) {
      return res.status(500).json({ error: 'Gagal mengunggah audio ke cloud: ' + e.message });
    }
  } else {
    return res.status(500).json({ error: 'Storage tidak dikonfigurasi (BLOB_READ_WRITE_TOKEN missing).' });
  }

  return res.json({ success: true, audioUrl, fileName: filename, fileSize: filePart.data.length });
}
