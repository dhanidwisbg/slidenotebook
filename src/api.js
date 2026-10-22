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

// Admin Auth APIs
export async function loginAdmin(email, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Login gagal.');
  }

  setAdminToken(data.token);
  return data;
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
    if (!res.ok) return { authenticated: false };
    return await res.json();
  } catch (e) {
    return { authenticated: false };
  }
}

// Admin Handbook APIs
export async function fetchAdminHandbooks() {
  const token = getAdminToken();
  const res = await fetch(`${API_BASE}/admin/handbooks`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Gagal memuat daftar handbook.');
  }
  return await res.json();
}

export async function fetchAdminHandbook(id) {
  const token = getAdminToken();
  const res = await fetch(`${API_BASE}/admin/handbooks/${id}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Gagal memuat handbook.');
  }
  return await res.json();
}

export async function createAdminHandbook(payload) {
  const token = getAdminToken();
  const res = await fetch(`${API_BASE}/admin/handbooks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Gagal membuat handbook.');
  }
  return await res.json();
}

export async function updateAdminHandbook(id, payload) {
  const token = getAdminToken();
  const res = await fetch(`${API_BASE}/admin/handbooks/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Gagal menyimpan perubahan handbook.');
  }
  return await res.json();
}

export async function uploadAdminAudio(file) {
  const token = getAdminToken();
  const formData = new FormData();
  formData.append('audio', file);

  const res = await fetch(`${API_BASE}/admin/upload-audio`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Gagal mengunggah file audio.');
  }
  return data;
}

export async function convertAdminPptx(file) {
  const token = getAdminToken();
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
}

// Public Reader API (Read-Only)
export async function fetchPublicHandbook(slugOrId, password = null) {
  const headers = {};
  if (password) {
    headers['x-reader-password'] = password;
  }

  const res = await fetch(`${API_BASE}/public/handbook/${encodeURIComponent(slugOrId)}`, {
    method: 'GET',
    headers
  });

  const data = await res.json();
  if (!res.ok) {
    return {
      status: 'error',
      code: res.status,
      errorType: data.error,
      message: data.message || 'Gagal memuat handbook.'
    };
  }

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
}
