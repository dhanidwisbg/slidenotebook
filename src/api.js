// API Client for Admin & Public Reader endpoints

const API_BASE = '/api';

export function getAdminToken() {
  return localStorage.getItem('hfb_admin_token');
}

export function setAdminToken(token) {
  if (token) {
    localStorage.setItem('hfb_admin_token', token);
  } else {
    localStorage.removeItem('hfb_admin_token');
  }
}

// Admin Auth APIs (registered name + password, approved by super admin)
export async function loginAdmin(password, name) {
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: name, password })
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setAdminToken(data.token);
      return data;
    }
    throw new Error(data.error || 'Nama atau password salah.');
  } catch (err) {
    if (err.message && !err.message.includes('Failed to fetch')) {
      throw err;
    }
    throw new Error('Server tidak terjangkau. Coba lagi nanti.');
  }
}

export async function logoutAdmin() {
  const token = getAdminToken();
  try {
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token ? `Bearer ${token}` : ''
      }
    });
  } catch (e) {
    // ignore
  }
  setAdminToken(null);
}

export async function checkAdminAuth() {
  const token = getAdminToken();
  if (!token) return { authenticated: false };

  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      return await res.json();
    } else if (res.status === 401) {
      setAdminToken(null);
      return { authenticated: false };
    }
  } catch (e) {
    // Static hosting fallback
  }

  // If token exists and we are on static host
  return {
    authenticated: true,
    user: { email: 'admin@flipbook.id', name: 'Administrator', role: 'admin' }
  };
}

// Safely set item in localStorage without throwing QuotaExceededError
function safeSetLocalStorage(key, value) {
  try {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    localStorage.setItem(key, serialized);
  } catch (err) {
    console.warn(`[localStorage] Quota exceeded for "${key}". Stripping image data for safety.`);
    try {
      if (Array.isArray(value)) {
        const stripped = value.map(h => ({
          ...h,
          pages: (h.pages || []).map(p => ({ ...p, dataUrl: '' }))
        }));
        localStorage.setItem(key, JSON.stringify(stripped));
      } else if (value && typeof value === 'object') {
        const stripped = {
          ...value,
          pages: (value.pages || []).map(p => ({ ...p, dataUrl: '' }))
        };
        localStorage.setItem(key, JSON.stringify(stripped));
      }
    } catch (e2) {
      console.warn('[localStorage] Skipping cache save due to storage limit.');
    }
  }
}

// Helper to get fallback handbooks from static JSON or localStorage
async function getFallbackHandbooks() {
  const local = localStorage.getItem('hfb_handbooks');
  if (local) {
    try {
      return JSON.parse(local);
    } catch (e) {}
  }
  try {
    const res = await fetch('/data/handbooks.json');
    if (res.ok) {
      const data = await res.json();
      safeSetLocalStorage('hfb_handbooks', data);
      return data;
    }
  } catch (e) {}
  return [];
}

// Admin Handbook APIs
export async function fetchAdminHandbooks() {
  const token = getAdminToken();
  try {
    const res = await fetch(`${API_BASE}/admin/handbooks`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {}

  // Fallback for Vercel
  const fallbacks = await getFallbackHandbooks();
  return fallbacks.map(h => ({
    id: h.id,
    uniqueSlug: h.uniqueSlug,
    title: h.title,
    subtitle: h.subtitle,
    orientation: h.orientation,
    pageCount: h.pages ? h.pages.length : 0,
    isPublished: h.isPublished,
    isActive: h.isActive
  }));
}

export async function fetchAdminHandbook(id) {
  const token = getAdminToken();
  try {
    const res = await fetch(`${API_BASE}/admin/handbooks/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {}

  // Fallback for Vercel
  const fallbacks = await getFallbackHandbooks();
  const found = fallbacks.find(h => h.id === id || h.uniqueSlug === id) || fallbacks[0];
  if (found) return found;
  throw new Error('Handbook tidak ditemukan.');
}

export async function createAdminHandbook(payload) {
  const token = getAdminToken();
  try {
    const res = await fetch(`${API_BASE}/admin/handbooks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      const data = await res.json();
      safeSetLocalStorage('hfb_handbook_default', data);
      return data;
    }
  } catch (e) {}

  // Fallback for Vercel
  const newHb = {
    ...payload,
    id: 'hb_' + Date.now(),
    uniqueSlug: 'bk-' + Math.random().toString(36).substring(2, 10),
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  const list = await getFallbackHandbooks();
  list.unshift(newHb);
  safeSetLocalStorage('hfb_handbooks', list);
  safeSetLocalStorage('hfb_handbook_default', newHb);
  return newHb;
}

export async function updateAdminHandbook(id, payload) {
  const token = getAdminToken();
  try {
    const res = await fetch(`${API_BASE}/admin/handbooks/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      const data = await res.json();
      safeSetLocalStorage('hfb_handbook_default', data);
      return data;
    } else {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Server error: ${res.status}`);
    }
  } catch (e) {
    if (e.message && e.message.startsWith('Server error')) {
      throw e;
    }
    console.warn('Backend update failed, attempting local fallback:', e);
  }

  // Fallback for Vercel
  const list = await getFallbackHandbooks();
  const idx = list.findIndex(h => h.id === id);
  const updated = {
    ...(list[idx] || {}),
    ...payload,
    id,
    updatedAt: Date.now()
  };
  if (idx !== -1) {
    list[idx] = updated;
  } else {
    list.unshift(updated);
  }
  safeSetLocalStorage('hfb_handbooks', list);
  safeSetLocalStorage('hfb_handbook_default', updated);
  return updated;
}

/**
 * Upload a single page image (as base64 dataUrl) directly to Vercel Blob.
 * Sends one image per request to stay under Vercel's 4.5MB serverless limit.
 * Returns { imageUrl } on success, null on failure (caller keeps dataUrl as fallback).
 */
export async function uploadPageImageToBlob(handbookId, pageId, dataUrl) {
  const token = getAdminToken();
  if (!token) return null;

  try {
    // Convert base64 dataUrl to Blob
    const match = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!match) return null;

    const mimeType = match[1];
    const ext = mimeType === 'image/jpeg' ? 'jpg' : mimeType.split('/')[1] || 'jpg';
    const binary = atob(match[2]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: mimeType });

    const formData = new FormData();
    formData.append('image', blob, `${pageId}.${ext}`);
    formData.append('handbookId', handbookId);
    formData.append('pageId', pageId);

    const res = await fetch(`${API_BASE}/admin/upload-image`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });

    if (res.ok) {
      const data = await res.json();
      return data.imageUrl || null;
    }
  } catch (e) {
    console.warn('[uploadPageImageToBlob] Failed:', e.message);
  }
  return null;
}

export async function convertAdminPptx(file) {
  const token = getAdminToken();
  try {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${API_BASE}/admin/convert-pptx`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });

    const data = await res.json();
    if (!res.ok) {
      const err = new Error(data.error || 'Gagal mengonversi file PowerPoint.');
      err.needManualExport = data.needManualExport;
      throw err;
    }
    return data;
  } catch (err) {
    if (err.needManualExport) throw err;
    const error = new Error('Konversi otomatis PowerPoint memerlukan backend server. Silakan simpan / export presentasi Anda sebagai PDF, lalu unggah file PDF-nya secara langsung.');
    error.needManualExport = true;
    throw error;
  }
}

export async function deleteAdminHandbook(id) {
  const token = getAdminToken();
  try {
    const res = await fetch(`${API_BASE}/admin/handbooks/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {}

  // Fallback for Vercel
  let list = await getFallbackHandbooks();
  list = list.filter(h => h.id !== id && h.uniqueSlug !== id);
  safeSetLocalStorage('hfb_handbooks', list);
  return { success: true };
}

// Public Catalog API (NO SLIDE IMAGES EXPOSED - SAFE FOR HOMEPAGE)
export async function fetchPublicCatalog() {
  try {
    const res = await fetch(`${API_BASE}/public/handbooks`);
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {}

  // Fallback for Vercel
  const list = await getFallbackHandbooks();
  return list
    .filter(h => h.isPublished !== false && h.isActive !== false)
    .map(h => ({
      id: h.id,
      uniqueSlug: h.uniqueSlug,
      title: h.title,
      subtitle: h.subtitle,
      orientation: h.orientation,
      coverColor: h.coverColor,
      pageCount: h.pages ? h.pages.length : 0,
      hasPassword: !!(h.readerPassword && h.readerPassword.trim() !== '')
    }));
}

// Public Reader API (Read-Only with PIN & Direct Access Key)
export async function fetchPublicHandbook(slugOrId, pinOrPassword = null, directKey = null) {
  const headers = {};
  if (pinOrPassword) {
    headers['x-reader-password'] = pinOrPassword;
  }
  if (directKey) {
    headers['x-access-key'] = directKey;
  }

  const queryParams = new URLSearchParams();
  if (pinOrPassword) queryParams.set('pin', pinOrPassword);
  if (directKey) queryParams.set('key', directKey);
  const qStr = queryParams.toString() ? `?${queryParams.toString()}` : '';

  try {
    const res = await fetch(`${API_BASE}/public/handbook/${encodeURIComponent(slugOrId)}${qStr}`, {
      method: 'GET',
      headers
    });

    if (res.ok) {
      const data = await res.json();
      if (data.passwordRequired) {
        return {
          status: 'password_required',
          title: data.title,
          subtitle: data.subtitle,
          coverColor: data.coverColor,
          message: data.message || 'Masukkan PIN untuk membaca.'
        };
      }
      return {
        status: 'success',
        handbook: data
      };
    } else if (res.status === 401 || res.status === 403) {
      const data = await res.json();
      return {
        status: 'error',
        code: res.status,
        errorType: data.error,
        message: data.message
      };
    }
  } catch (e) {
    // Fallback for Vercel
  }

  // Static / Vercel fallback
  const list = await getFallbackHandbooks();
  const hb = list.find(h => h.id === slugOrId || h.uniqueSlug === slugOrId) || list[0];

  if (hb) {
    if (hb.isActive === false) {
      return {
        status: 'error',
        code: 403,
        errorType: 'disabled',
        message: 'Handbook ini telah dinonaktifkan.'
      };
    }

    // Check PIN and Direct Access Key
    if (hb.readerPassword && hb.readerPassword.trim() !== '') {
      const isDirectKeyValid = directKey && (directKey === hb.accessKey || directKey === hb.uniqueSlug);
      const isPinValid = pinOrPassword && pinOrPassword === hb.readerPassword;

      if (!isDirectKeyValid && !isPinValid) {
        return {
          status: 'password_required',
          title: hb.title,
          subtitle: hb.subtitle,
          coverColor: hb.coverColor,
          message: 'Handbook ini dilindungi PIN oleh administrator.'
        };
      }
    }

    return {
      status: 'success',
      handbook: hb
    };
  }

  return {
    status: 'error',
    code: 404,
    errorType: 'not_found',
    message: 'Handbook tidak ditemukan.'
  };
}
