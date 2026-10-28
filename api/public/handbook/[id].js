// /api/public/handbook/[id] - Public reader with PIN + direct key
import { setCORSHeaders, readHandbooksDB } from '../../_shared.js';

export default async function handler(req, res) {
  setCORSHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.query;
  const list = await readHandbooksDB();

  let handbook = list.find(function(h) { return h.uniqueSlug === id || h.id === id; });
  if (!handbook && (id === 'default' || id === 'preview' || list.length === 1)) {
    handbook = list.find(function(h) { return h.isPublished; }) || list[0];
  }

  if (!handbook) {
    return res.status(404).json({ error: 'not_found', message: 'Handbook tidak ditemukan atau link sudah tidak berlaku.' });
  }
  if (!handbook.isPublished) {
    const isPreview = req.query.preview === '1' || id === 'preview';
    if (!isPreview) {
      return res.status(403).json({ error: 'unpublished', message: 'Handbook ini belum dipublikasikan oleh pemiliknya.' });
    }
  }
  if (handbook.isActive === false) {
    return res.status(403).json({ error: 'disabled', message: 'Handbook ini telah dinonaktifkan oleh administrator.' });
  }

  if (handbook.readerPassword && handbook.readerPassword.trim() !== '') {
    const providedKey = req.query.key || req.headers['x-access-key'];
    const providedPin = req.headers['x-reader-password'] || req.query.pwd || req.query.pin;
    const isDirectKeyValid = providedKey && (providedKey === handbook.accessKey || providedKey === handbook.uniqueSlug);
    const isPinValid = providedPin && providedPin === handbook.readerPassword;

    if (!isDirectKeyValid && !isPinValid) {
      return res.status(200).json({
        passwordRequired: true,
        title: handbook.title,
        subtitle: handbook.subtitle,
        coverColor: handbook.coverColor,
        message: 'Handbook ini dilindungi PIN oleh administrator.'
      });
    }
  }

  return res.json({
    id: handbook.id,
    uniqueSlug: handbook.uniqueSlug,
    title: handbook.title,
    subtitle: handbook.subtitle,
    orientation: handbook.orientation,
    coverColor: handbook.coverColor,
    pages: handbook.pages,
    updatedAt: handbook.updatedAt
  });
}