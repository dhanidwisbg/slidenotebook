// /api/public/handbooks - Public catalog (no images)
import { setCORSHeaders, readHandbooksDB } from '../_shared.js';

export default async function handler(req, res) {
  setCORSHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const list = await readHandbooksDB();
  const catalog = list
    .filter(function(h) { return h.isPublished && h.isActive !== false; })
    .map(function(h) {
      return {
        id: h.id,
        uniqueSlug: h.uniqueSlug,
        title: h.title,
        subtitle: h.subtitle,
        orientation: h.orientation,
        coverColor: h.coverColor,
        pageCount: h.pages ? h.pages.length : 0,
        hasPassword: !!(h.readerPassword && h.readerPassword.trim() !== ''),
        updatedAt: h.updatedAt || h.createdAt
      };
    });

  return res.json(catalog);
}
