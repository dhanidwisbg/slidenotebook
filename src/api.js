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

// Admin Auth APIs (Passcode: 12345678)
export async function loginAdmin(passcode) {
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode })
    });

    if (res.ok) {
      const data = await res.json();
      setAdminToken(data.token);
      return data;
    } else if (res.status === 401) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Kode akses admin salah.');
    }
  } catch (err) {
    if (err.message && err.message.includes('Kode akses')) {
      throw err;
    }
    // Fallback for Vercel static deployments where Express API isn't running
    console.warn('API server unreachable, evaluating passcode locally for Vercel static hosting.');
  }

  // Client-side validation fallback for Vercel static deploy
  if (passcode === '12345678') {
    const token = 'token_admin_' + Date.now();
    setAdminToken(token);
    return {
      success: true,
      token,
      user: { email: 'admin@flipbook.id', name: 'Administrator', role: 'admin' }
    };
  } else {
    throw new Error('Kode akses admin salah. Masukkan kode 12345678.');
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
      localStorage.setItem('hfb_handbooks', JSON.stringify(data));
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
      return await res.json();
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
  localStorage.setItem('hfb_handbooks', JSON.stringify(list));
  localStorage.setItem('hfb_handbook_default', JSON.stringify(newHb));
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
      localStorage.setItem('hfb_handbook_default', JSON.stringify(data));
      return data;
    }
  } catch (e) {}

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
  localStorage.setItem('hfb_handbooks', JSON.stringify(list));
  localStorage.setItem('hfb_handbook_default', JSON.stringify(updated));
  return updated;
}

export async function uploadAdminAudio(file) {
  const token = getAdminToken();
  try {
    const formData = new FormData();
    formData.append('audio', file);

    const res = await fetch(`${API_BASE}/admin/upload-audio`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });

    if (res.ok) {
      return await res.json();
    }
  } catch (e) {}

  // Fallback for Vercel: read audio as dataUrl
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ audioUrl: reader.result, filename: file.name });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
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

// Public Reader API (Read-Only)
export async function fetchPublicHandbook(slugOrId, password = null) {
  const headers = {};
  if (password) {
    headers['x-reader-password'] = password;
  }

  try {
    const res = await fetch(`${API_BASE}/public/handbook/${encodeURIComponent(slugOrId)}`, {
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
          message: data.message
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
    if (!hb.isActive) {
      return {
        status: 'error',
        code: 403,
        errorType: 'disabled',
        message: 'Handbook ini telah dinonaktifkan.'
      };
    }
    if (hb.readerPassword && hb.readerPassword !== password) {
      return {
        status: 'password_required',
        title: hb.title,
        subtitle: hb.subtitle,
        coverColor: hb.coverColor,
        message: 'Masukkan kata sandi untuk membaca.'
      };
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
