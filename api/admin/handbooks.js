// /api/admin/handbooks - GET list, POST create
import { setCORSHeaders, requireAdmin, readHandbooksDB, writeHandbooksDB, uploadSlideImages } from '../_shared.js';
import crypto from 'crypto';

export const config = { api: { bodyParser: { sizeLimit: '150mb' } } };

export default async function handler(req, res) {
  setCORSHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const admin = requireAdmin(req, res);
  if (!admin) return;

  // GET - list handbooks owned by this admin (summary only)
  if (req.method === 'GET') {
    const list = await readHandbooksDB();
    const owner = admin.email || '';
    const visible = list.filter(function(item) { return !item.ownerName || item.ownerName === owner; });
    const summaries = visible.map(function(item) {
      return {
        id: item.id,
        uniqueSlug: item.uniqueSlug,
        title: item.title,
        subtitle: item.subtitle,
        orientation: item.orientation,
        coverColor: item.coverColor,
        ownerName: item.ownerName || null,
        coverImage: (item.pages && item.pages.length > 0) ? (item.pages[0].imageUrl || null) : null,
        pageCount: item.pages ? item.pages.length : 0,
        isPublished: !!item.isPublished,
        isActive: item.isActive !== false,
        readerPassword: item.readerPassword || null,
        hasPassword: !!(item.readerPassword && item.readerPassword.trim() !== ''),
        accessKey: item.accessKey || ('key_' + (item.uniqueSlug || item.id)),
        updatedAt: item.updatedAt || item.createdAt
      };
    });
    return res.json(summaries);
  }

  // POST - create new handbook
  if (req.method === 'POST') {
    const body = req.body || {};
    const { title, subtitle, orientation, coverColor, pages, readerPassword } = body;
    const list = await readHandbooksDB();

    const id = 'hb_' + Date.now();
    const uniqueSlug = 'bk-' + crypto.randomBytes(4).toString('hex');
    const accessKey = 'key_' + crypto.randomBytes(6).toString('hex');

    const storedPages = await uploadSlideImages(id, pages || []);

    const newHandbook = {
      id,
      uniqueSlug,
      accessKey,
      ownerName: admin.email || null,
      title: title || 'Handbook Baru',
      subtitle: subtitle || '',
      orientation: orientation || 'portrait',
      coverColor: coverColor || '#1e293b',
      pages: storedPages,
      isPublished: true,
      isActive: true,
      readerPassword: readerPassword || null,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    list.unshift(newHandbook);
    const saved = await writeHandbooksDB(list);
    if (!saved) {
      return res.status(500).json({ error: 'Gagal menyimpan handbook ke database.' });
    }

    return res.status(201).json(newHandbook);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
