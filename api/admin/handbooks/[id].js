// /api/admin/handbooks/[id] - GET one, PUT update, DELETE
import { setCORSHeaders, requireAdmin, readHandbooksDB, writeHandbooksDB, uploadSlideImages, deleteBlobFiles } from '../../_shared.js';

export const config = { api: { bodyParser: { sizeLimit: '150mb' } } };

export default async function handler(req, res) {
  setCORSHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const admin = requireAdmin(req, res);
  if (!admin) return;

  const { id } = req.query;
  const list = await readHandbooksDB();
  const index = list.findIndex(function(h) { return h.id === id || h.uniqueSlug === id; });
  const found = index !== -1 ? list[index] : null;

  if (req.method === 'GET') {
    if (!found) return res.status(404).json({ error: 'Handbook tidak ditemukan.' });
    if (!found.accessKey) found.accessKey = 'key_' + (found.uniqueSlug || found.id);
    return res.json(found);
  }

  if (req.method === 'PUT') {
    if (!found) return res.status(404).json({ error: 'Handbook tidak ditemukan.' });
    const body = req.body || {};
    const { title, subtitle, orientation, coverColor, pages, isPublished, isActive, readerPassword, accessKey } = body;
    let storedPages = found.pages;
    if (pages !== undefined) {
      storedPages = await uploadSlideImages(found.id, pages);
    }
    list[index] = {
      ...found,
      accessKey: accessKey || found.accessKey || ('key_' + (found.uniqueSlug || found.id)),
      title: title !== undefined ? title : found.title,
      subtitle: subtitle !== undefined ? subtitle : found.subtitle,
      orientation: orientation !== undefined ? orientation : found.orientation,
      coverColor: coverColor !== undefined ? coverColor : found.coverColor,
      pages: storedPages,
      isPublished: isPublished !== undefined ? isPublished : found.isPublished,
      isActive: isActive !== undefined ? isActive : found.isActive,
      readerPassword: readerPassword !== undefined ? readerPassword : found.readerPassword,
      updatedAt: Date.now()
    };
    const saved = await writeHandbooksDB(list);
    if (!saved) return res.status(500).json({ error: 'Gagal menyimpan perubahan.' });
    return res.json(list[index]);
  }

  if (req.method === 'DELETE') {
    if (!found) return res.status(404).json({ error: 'Handbook tidak ditemukan.' });
    if (found.pages) {
      const imageUrls = found.pages.map(function(p) { return p.imageUrl; }).filter(Boolean);
      await deleteBlobFiles(imageUrls);
    }
    const newList = list.filter(function(h) { return h.id !== found.id; });
    await writeHandbooksDB(newList);
    return res.json({ success: true, message: 'Handbook dan file terkait berhasil dihapus.' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}