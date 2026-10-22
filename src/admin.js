// Admin Portal Logic - Handbook Flipbook
// Enforces server-side authentication and full handbook management

import {
  loginAdmin,
  logoutAdmin,
  checkAdminAuth,
  fetchAdminHandbooks,
  fetchAdminHandbook,
  createAdminHandbook,
  updateAdminHandbook,
  uploadAdminAudio,
  convertAdminPptx
} from './api.js';
import {
  naturalSort,
  processImageFile,
  checkOrientationMismatch
} from './compressor.js';
import { convertPdfToPages } from './pdf-loader.js';
import { generateSamplePages } from './sample-data.js';

// Admin State
const adminState = {
  user: null,
  handbook: null, // active handbook object from server
  draggedCardIndex: null,
  testAudioEl: new Audio()
};

// DOM references
const DOM = {
  loginScreen: document.getElementById('login-screen'),
  loginForm: document.getElementById('login-form'),
  loginEmail: document.getElementById('login-email'),
  loginPassword: document.getElementById('login-password'),
  loginError: document.getElementById('login-error'),
  adminMain: document.getElementById('admin-main'),
  adminUserEmail: document.getElementById('admin-user-email'),
  btnLogout: document.getElementById('btn-logout'),

  // Metadata
  hbTitle: document.getElementById('hb-title'),
  hbSubtitle: document.getElementById('hb-subtitle'),
  btnOrientPort: document.getElementById('btn-orient-port'),
  btnOrientLand: document.getElementById('btn-orient-land'),
  swatches: document.getElementById('admin-color-swatches'),
  customColor: document.getElementById('admin-custom-color'),

  // Audio
  btnTriggerAudioUpload: document.getElementById('btn-trigger-audio-upload'),
  adminAudioInput: document.getElementById('admin-audio-input'),
  audioFileStatus: document.getElementById('audio-file-status'),
  btnTestAudioPlay: document.getElementById('btn-test-audio-play'),
  btnRemoveAudio: document.getElementById('btn-remove-audio'),
  chkAudioAutoplay: document.getElementById('chk-audio-autoplay'),
  adminAudioVolume: document.getElementById('admin-audio-volume'),
  volumeValLabel: document.getElementById('volume-val-label'),

  // Upload Zone
  uploadZone: document.getElementById('admin-upload-zone'),
  fileInput: document.getElementById('admin-file-input'),
  btnAddMore: document.getElementById('btn-add-more-admin'),
  btnLoadSample: document.getElementById('btn-load-sample-admin'),

  // Mismatch Alert
  mismatchBanner: document.getElementById('admin-mismatch-banner'),
  mismatchText: document.getElementById('admin-mismatch-text'),
  btnAutoSwitchOrient: document.getElementById('btn-auto-switch-orient'),

  // Pages
  pagesGrid: document.getElementById('admin-pages-grid'),
  pageCount: document.getElementById('admin-page-count'),
  btnClearAllPages: document.getElementById('btn-clear-all-pages'),

  // Publish Modal
  btnOpenPublishModal: document.getElementById('btn-open-publish-modal'),
  publishModal: document.getElementById('publish-modal'),
  btnClosePublishModal: document.getElementById('btn-close-publish-modal'),
  btnCancelPublish: document.getElementById('btn-cancel-publish'),
  publicLinkInput: document.getElementById('public-link-input'),
  btnCopyPublicLink: document.getElementById('btn-copy-public-link'),
  readerPasswordInput: document.getElementById('reader-password-input'),
  btnToggleLinkActive: document.getElementById('btn-toggle-link-active'),
  linkStatusLabel: document.getElementById('link-status-label'),
  linkStatusDesc: document.getElementById('link-status-desc'),
  btnConfirmPublish: document.getElementById('btn-confirm-publish'),

  // Preview Modal
  btnPreviewReader: document.getElementById('btn-preview-reader'),
  previewModal: document.getElementById('preview-modal'),
  previewIframe: document.getElementById('preview-iframe'),
  btnClosePreviewModal: document.getElementById('btn-close-preview-modal'),
  btnOpenPreviewTab: document.getElementById('btn-open-preview-tab'),

  toast: document.getElementById('admin-toast')
};

// ============================================================================
// INITIALIZATION & AUTH CHECK
// ============================================================================
async function initAdmin() {
  const auth = await checkAdminAuth();
  if (!auth.authenticated) {
    showLogin();
  } else {
    adminState.user = auth.user;
    showDashboard();
  }

  setupEventListeners();
}

function showLogin() {
  DOM.loginScreen.style.display = 'flex';
  DOM.adminMain.style.display = 'none';
}

async function showDashboard() {
  DOM.loginScreen.style.display = 'none';
  DOM.adminMain.style.display = 'block';
  DOM.adminUserEmail.textContent = adminState.user.email;

  await loadHandbook();
}

// Load or create the default server handbook
async function loadHandbook() {
  try {
    const list = await fetchAdminHandbooks();
    if (list && list.length > 0) {
      // Load details of the first handbook
      adminState.handbook = await fetchAdminHandbook(list[0].id);
    } else {
      // Create initial demo handbook on server
      const initialPages = generateSamplePages('#1e293b');
      adminState.handbook = await createAdminHandbook({
        title: 'Handbook Budaya & Desain Sistem',
        subtitle: 'Panduan Operasional Tim Digital 2026',
        orientation: 'portrait',
        coverColor: '#1e293b',
        pages: initialPages,
        audioUrl: null,
        autoplay: true,
        initialVolume: 0.45,
        isPublished: true,
        isActive: true,
        readerPassword: null
      });
    }

    syncHandbookToUI();
    renderPagesGrid();
    checkOrientationAlert();
  } catch (err) {
    showToast(`Error: ${err.message}`);
  }
}

// ============================================================================
// SYNC STATE TO UI
// ============================================================================
function syncHandbookToUI() {
  const hb = adminState.handbook;
  if (!hb) return;

  DOM.hbTitle.value = hb.title || '';
  DOM.hbSubtitle.value = hb.subtitle || '';

  // Orientation
  if (hb.orientation === 'landscape') {
    DOM.btnOrientLand.classList.add('active');
    DOM.btnOrientPort.classList.remove('active');
  } else {
    DOM.btnOrientPort.classList.add('active');
    DOM.btnOrientLand.classList.remove('active');
  }

  // Cover Color
  DOM.customColor.value = hb.coverColor || '#1e293b';
  DOM.swatches.querySelectorAll('.color-dot').forEach((dot) => {
    dot.classList.toggle('active', dot.dataset.color === hb.coverColor);
  });

  // Audio settings
  if (hb.audioUrl) {
    DOM.audioFileStatus.textContent = 'Audio terpasang';
    DOM.audioFileStatus.style.color = 'var(--accent-success)';
    DOM.btnTestAudioPlay.style.display = 'flex';
    DOM.btnRemoveAudio.style.display = 'flex';
    adminState.testAudioEl.src = hb.audioUrl;
  } else {
    DOM.audioFileStatus.textContent = 'Belum ada musik';
    DOM.audioFileStatus.style.color = 'var(--text-muted)';
    DOM.btnTestAudioPlay.style.display = 'none';
    DOM.btnRemoveAudio.style.display = 'none';
  }

  DOM.chkAudioAutoplay.checked = hb.autoplay !== false;
  DOM.adminAudioVolume.value = typeof hb.initialVolume === 'number' ? hb.initialVolume : 0.45;
  DOM.volumeValLabel.textContent = `${Math.round(DOM.adminAudioVolume.value * 100)}%`;

  DOM.pageCount.textContent = `${(hb.pages || []).length} Halaman`;
}

function renderPagesGrid() {
  DOM.pagesGrid.innerHTML = '';
  const pages = adminState.handbook.pages || [];
  DOM.pageCount.textContent = `${pages.length} Halaman`;

  pages.forEach((page, index) => {
    const isCover = index === 0;
    const isBackCover = index === pages.length - 1;
    const hasMismatch = checkOrientationMismatch(page, adminState.handbook.orientation);

    const card = document.createElement('div');
    card.className = `page-card ${adminState.handbook.orientation === 'landscape' ? 'landscape' : ''}`;
    card.dataset.index = index;

    let badgeText = '';
    if (isCover) badgeText = 'Sampul Depan';
    else if (isBackCover) badgeText = 'Sampul Belakang';

    card.innerHTML = `
      <div class="page-card-thumbnail-wrap" draggable="true" title="Tarik gambar untuk memindahkan urutan">
        <img src="${page.dataUrl}" alt="${page.title}" class="page-card-thumbnail" loading="lazy" />
        ${badgeText ? `<div class="page-badge-cover">${badgeText}</div>` : ''}
        ${hasMismatch ? `<div class="page-card-warning-tag" title="Rasio halaman berbeda dari orientasi buku">⚠️ Rasio Beda</div>` : ''}
      </div>
      <div class="page-card-info">
        <input type="text" class="page-title-input" value="${page.title || `Halaman ${index + 1}`}" placeholder="Judul Halaman..." data-index="${index}" />
        <div class="page-card-footer">
          <span class="page-num-label">Hal ${index + 1} (${page.width}x${page.height}px)</span>
          <div class="page-actions-row">
            <button type="button" class="btn-card-action btn-move-left" title="Geser ke kiri / awal" data-index="${index}" ${index === 0 ? 'disabled style="opacity:0.3;"' : ''}>◀</button>
            <button type="button" class="btn-card-action btn-move-right" title="Geser ke kanan / akhir" data-index="${index}" ${index === pages.length - 1 ? 'disabled style="opacity:0.3;"' : ''}>▶</button>
            <button type="button" class="btn-card-action btn-delete" title="Hapus halaman ini" data-index="${index}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </div>
      </div>
    `;

    // Drag-and-drop on thumbnail wrap
    const thumbWrap = card.querySelector('.page-card-thumbnail-wrap');
    thumbWrap.addEventListener('dragstart', (e) => {
      adminState.draggedCardIndex = index;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    thumbWrap.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      adminState.draggedCardIndex = null;
    });

    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });

    card.addEventListener('drop', async (e) => {
      e.preventDefault();
      const targetIndex = index;
      if (adminState.draggedCardIndex !== null && adminState.draggedCardIndex !== targetIndex) {
        const item = adminState.handbook.pages.splice(adminState.draggedCardIndex, 1)[0];
        adminState.handbook.pages.splice(targetIndex, 0, item);
        await autoSaveHandbook();
        renderPagesGrid();
        showToast('Urutan halaman diperbarui.');
      }
    });

    // Inline title edit
    const titleInput = card.querySelector('.page-title-input');
    titleInput.addEventListener('change', async (e) => {
      adminState.handbook.pages[index].title = e.target.value.trim();
      await autoSaveHandbook();
      showToast('Judul halaman diperbarui.');
    });

    // Move left/right
    card.querySelector('.btn-move-left').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (index > 0) {
        const item = adminState.handbook.pages.splice(index, 1)[0];
        adminState.handbook.pages.splice(index - 1, 0, item);
        await autoSaveHandbook();
        renderPagesGrid();
      }
    });

    card.querySelector('.btn-move-right').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (index < adminState.handbook.pages.length - 1) {
        const item = adminState.handbook.pages.splice(index, 1)[0];
        adminState.handbook.pages.splice(index + 1, 0, item);
        await autoSaveHandbook();
        renderPagesGrid();
      }
    });

    // Reliable Delete button
    const deleteBtn = card.querySelector('.btn-delete');
    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();
      const pageTitle = page.title || `Halaman ${index + 1}`;
      if (confirm(`Hapus ${pageTitle}?`)) {
        adminState.handbook.pages.splice(index, 1);
        await autoSaveHandbook();
        renderPagesGrid();
        checkOrientationAlert();
        showToast(`Halaman "${pageTitle}" telah dihapus.`);
      }
    });

    DOM.pagesGrid.appendChild(card);
  });
}

function checkOrientationAlert() {
  const pages = adminState.handbook?.pages || [];
  if (pages.length === 0) {
    DOM.mismatchBanner.style.display = 'none';
    return;
  }

  const mismatchedCount = pages.filter((p) =>
    checkOrientationMismatch(p, adminState.handbook.orientation)
  ).length;

  if (mismatchedCount > 0) {
    DOM.mismatchBanner.style.display = 'flex';
    DOM.mismatchText.textContent = `${mismatchedCount} gambar memiliki orientasi berbeda dari buku (${adminState.handbook.orientation}). Halaman tetap tampil rapi tanpa distorsi.`;
    DOM.btnAutoSwitchOrient.textContent = `Ubah ke ${adminState.handbook.orientation === 'portrait' ? 'Landscape (16:9)' : 'Portrait (A-Series)'}`;
  } else {
    DOM.mismatchBanner.style.display = 'none';
  }
}

async function autoSaveHandbook() {
  if (!adminState.handbook) return;
  try {
    adminState.handbook = await updateAdminHandbook(adminState.handbook.id, adminState.handbook);
  } catch (err) {
    showToast(`Gagal menyimpan: ${err.message}`);
  }
}

// ============================================================================
// UPLOAD HANDLERS
// ============================================================================
async function handleFilesUpload(files) {
  if (!files || files.length === 0) return;

  const fileList = Array.from(files);
  const images = [];
  const pdfs = [];
  const ppts = [];

  fileList.forEach((file) => {
    const name = file.name.toLowerCase();
    if (name.endsWith('.pptx') || name.endsWith('.ppt') || file.type.includes('presentation')) {
      ppts.push(file);
    } else if (file.type === 'application/pdf' || name.endsWith('.pdf')) {
      pdfs.push(file);
    } else if (file.type.startsWith('image/')) {
      images.push(file);
    }
  });

  // Natural numeric sort for images (slide2 before slide10)
  images.sort(naturalSort);

  showToast(`Memproses ${fileList.length} file...`);

  const newPages = [];

  // 1. Process PowerPoint (.pptx / .ppt) via Server Native PowerPoint Conversion
  for (const pptFile of ppts) {
    try {
      showToast(`Mengonversi presentasi PowerPoint: ${pptFile.name}...`);
      const convertRes = await convertAdminPptx(pptFile);
      showToast(`Mengekstrak slide dari hasil konversi: ${pptFile.name}...`);

      // Fetch the converted PDF from server
      const pdfBlob = await fetch(convertRes.pdfUrl).then((r) => r.blob());
      const extracted = await convertPdfToPages(pdfBlob);
      newPages.push(...extracted);
      showToast(`Berhasil mengekstrak ${extracted.length} slide dari ${pptFile.name}!`);
    } catch (err) {
      console.error(err);
      alert(`⚠️ ${err.message}\n\n💡 Alternatif Praktis: Buka file presentasi Anda di PowerPoint, lalu pilih "File > Export / Save As > PDF", kemudian tarik file PDF tersebut ke sini!`);
    }
  }

  // 2. Compress images to max 1800 px
  for (const imgFile of images) {
    try {
      const page = await processImageFile(imgFile, 1800, 0.88);
      newPages.push(page);
    } catch (err) {
      console.error(err);
      showToast(`Gagal memuat ${imgFile.name}: ${err.message}`);
    }
  }

  // 3. Extract PDF documents
  for (const pdfFile of pdfs) {
    try {
      showToast(`Mengekstrak PDF: ${pdfFile.name}...`);
      const extracted = await convertPdfToPages(pdfFile);
      newPages.push(...extracted);
    } catch (err) {
      console.error(err);
      showToast(`Gagal membaca PDF: ${err.message}`);
    }
  }

  if (newPages.length === 0) return;

  // Auto-detect orientation from first slide if no pages yet
  if ((adminState.handbook.pages || []).length === 0 && newPages[0]) {
    adminState.handbook.orientation = newPages[0].orientation;
    syncHandbookToUI();
  }

  adminState.handbook.pages = adminState.handbook.pages || [];
  adminState.handbook.pages.push(...newPages);

  await autoSaveHandbook();
  renderPagesGrid();
  checkOrientationAlert();
  showToast(`Berhasil menambahkan ${newPages.length} slide baru!`);
}

// ============================================================================
// PUBLISH MODAL & SHARING
// ============================================================================
function openPublishModal() {
  const hb = adminState.handbook;
  if (!hb) return;

  const publicUrl = `${window.location.origin}/read.html?id=${hb.uniqueSlug}`;
  DOM.publicLinkInput.value = publicUrl;
  DOM.readerPasswordInput.value = hb.readerPassword || '';

  const isActive = hb.isActive !== false;
  updateLinkStatusUI(isActive);

  DOM.publishModal.style.display = 'flex';
}

function updateLinkStatusUI(isActive) {
  if (isActive) {
    DOM.linkStatusLabel.textContent = 'Status Link: Aktif';
    DOM.linkStatusLabel.style.color = 'var(--accent-success)';
    DOM.linkStatusDesc.textContent = 'Pembaca dapat mengakses handbook lewat link ini.';
    DOM.btnToggleLinkActive.textContent = 'Nonaktifkan Link';
    DOM.btnToggleLinkActive.style.color = 'var(--accent-danger)';
  } else {
    DOM.linkStatusLabel.textContent = 'Status Link: Dinonaktifkan';
    DOM.linkStatusLabel.style.color = 'var(--accent-danger)';
    DOM.linkStatusDesc.textContent = 'Link tidak dapat dibuka oleh pembaca sampai diaktifkan kembali.';
    DOM.btnToggleLinkActive.textContent = 'Aktifkan Link';
    DOM.btnToggleLinkActive.style.color = 'var(--accent-success)';
  }
}

// ============================================================================
// PREVIEW MODAL
// ============================================================================
function openPreviewModal() {
  const hb = adminState.handbook;
  if (!hb) return;

  const previewUrl = `/read.html?id=${hb.uniqueSlug}&preview=1`;
  DOM.previewIframe.src = previewUrl;
  DOM.previewModal.style.display = 'flex';
}

function closePreviewModal() {
  DOM.previewModal.style.display = 'none';
  DOM.previewIframe.src = 'about:blank';
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================
function setupEventListeners() {
  // Login form
  DOM.loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    DOM.loginError.style.display = 'none';

    try {
      const email = DOM.loginEmail.value.trim();
      const password = DOM.loginPassword.value;
      const res = await loginAdmin(email, password);
      adminState.user = res.user;
      showToast('Login berhasil sebagai Administrator!');
      await showDashboard();
    } catch (err) {
      DOM.loginError.textContent = err.message || 'Login gagal. Periksa kembali email dan password.';
      DOM.loginError.style.display = 'block';
    }
  });

  // Logout
  DOM.btnLogout.addEventListener('click', async () => {
    if (confirm('Keluar dari portal admin?')) {
      await logoutAdmin();
      adminState.user = null;
      adminState.handbook = null;
      showLogin();
      showToast('Anda telah logout.');
    }
  });

  // Title & Subtitle changes
  DOM.hbTitle.addEventListener('change', async (e) => {
    adminState.handbook.title = e.target.value.trim();
    await autoSaveHandbook();
  });

  DOM.hbSubtitle.addEventListener('change', async (e) => {
    adminState.handbook.subtitle = e.target.value.trim();
    await autoSaveHandbook();
  });

  // Orientation toggle
  DOM.btnOrientPort.addEventListener('click', async () => {
    adminState.handbook.orientation = 'portrait';
    syncHandbookToUI();
    renderPagesGrid();
    checkOrientationAlert();
    await autoSaveHandbook();
    showToast('Orientasi buku diubah ke Portrait.');
  });

  DOM.btnOrientLand.addEventListener('click', async () => {
    adminState.handbook.orientation = 'landscape';
    syncHandbookToUI();
    renderPagesGrid();
    checkOrientationAlert();
    await autoSaveHandbook();
    showToast('Orientasi buku diubah ke Landscape.');
  });

  DOM.btnAutoSwitchOrient.addEventListener('click', async () => {
    adminState.handbook.orientation = adminState.handbook.orientation === 'portrait' ? 'landscape' : 'portrait';
    syncHandbookToUI();
    renderPagesGrid();
    checkOrientationAlert();
    await autoSaveHandbook();
  });

  // Color Swatches
  DOM.swatches.querySelectorAll('.color-dot').forEach((dot) => {
    dot.addEventListener('click', async () => {
      adminState.handbook.coverColor = dot.dataset.color;
      syncHandbookToUI();
      await autoSaveHandbook();
    });
  });

  DOM.customColor.addEventListener('input', async (e) => {
    adminState.handbook.coverColor = e.target.value;
    syncHandbookToUI();
    await autoSaveHandbook();
  });

  // Audio Upload & Controls
  DOM.btnTriggerAudioUpload.addEventListener('click', () => DOM.adminAudioInput.click());
  DOM.adminAudioInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 12 * 1024 * 1024) {
      alert('Ukuran file audio melebihi batas 12 MB.');
      return;
    }

    try {
      showToast(`Mengunggah musik: ${file.name}...`);
      const uploadRes = await uploadAdminAudio(file);
      adminState.handbook.audioUrl = uploadRes.audioUrl;
      await autoSaveHandbook();
      syncHandbookToUI();
      showToast('Musik latar berhasil diunggah ke server.');
    } catch (err) {
      alert(err.message);
    }
  });

  DOM.btnTestAudioPlay.addEventListener('click', () => {
    if (adminState.testAudioEl.paused) {
      adminState.testAudioEl.volume = parseFloat(DOM.adminAudioVolume.value);
      adminState.testAudioEl.play();
      DOM.btnTestAudioPlay.textContent = '⏸';
    } else {
      adminState.testAudioEl.pause();
      DOM.btnTestAudioPlay.textContent = '▶';
    }
  });

  DOM.btnRemoveAudio.addEventListener('click', async () => {
    if (confirm('Hapus musik latar ini?')) {
      adminState.testAudioEl.pause();
      adminState.handbook.audioUrl = null;
      await autoSaveHandbook();
      syncHandbookToUI();
      showToast('Musik latar dihapus.');
    }
  });

  DOM.chkAudioAutoplay.addEventListener('change', async (e) => {
    adminState.handbook.autoplay = e.target.checked;
    await autoSaveHandbook();
  });

  DOM.adminAudioVolume.addEventListener('input', async (e) => {
    const val = parseFloat(e.target.value);
    DOM.volumeValLabel.textContent = `${Math.round(val * 100)}%`;
    adminState.handbook.initialVolume = val;
    adminState.testAudioEl.volume = val;
    await autoSaveHandbook();
  });

  // Upload Zone
  DOM.uploadZone.addEventListener('click', () => DOM.fileInput.click());
  DOM.btnAddMore.addEventListener('click', () => DOM.fileInput.click());
  DOM.fileInput.addEventListener('change', (e) => {
    handleFilesUpload(e.target.files);
    e.target.value = '';
  });

  DOM.uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    DOM.uploadZone.classList.add('drag-over');
  });

  DOM.uploadZone.addEventListener('dragleave', () => {
    DOM.uploadZone.classList.remove('drag-over');
  });

  DOM.uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    DOM.uploadZone.classList.remove('drag-over');
    handleFilesUpload(e.dataTransfer.files);
  });

  // Clear all slides
  DOM.btnClearAllPages.addEventListener('click', async () => {
    const count = (adminState.handbook?.pages || []).length;
    if (count === 0) {
      showToast('Daftar slide sudah kosong.');
      return;
    }
    if (confirm(`Hapus semua (${count}) slide saat ini? Buku akan dikosongkan agar Anda dapat mengunggah slide PowerPoint/PDF Anda sendiri.`)) {
      adminState.handbook.pages = [];
      await autoSaveHandbook();
      renderPagesGrid();
      checkOrientationAlert();
      showToast('Semua slide telah dihapus. Silakan upload slide Anda!');
    }
  });

  // Load sample demo slides
  DOM.btnLoadSample.addEventListener('click', async () => {
    if (confirm('Muat contoh slide? Ini akan mengganti slide saat ini.')) {
      adminState.handbook.pages = generateSamplePages(adminState.handbook.coverColor);
      await autoSaveHandbook();
      renderPagesGrid();
      checkOrientationAlert();
      showToast('Contoh slide berhasil dimuat.');
    }
  });

  // Publish Modal events
  DOM.btnOpenPublishModal.addEventListener('click', openPublishModal);
  DOM.btnClosePublishModal.addEventListener('click', () => DOM.publishModal.style.display = 'none');
  DOM.btnCancelPublish.addEventListener('click', () => DOM.publishModal.style.display = 'none');

  DOM.btnCopyPublicLink.addEventListener('click', () => {
    navigator.clipboard.writeText(DOM.publicLinkInput.value).then(() => {
      showToast('Link berhasil disalin ke clipboard!');
      DOM.btnCopyPublicLink.textContent = 'Tersalin!';
      setTimeout(() => (DOM.btnCopyPublicLink.textContent = 'Salin Link'), 2000);
    });
  });

  DOM.btnToggleLinkActive.addEventListener('click', async () => {
    const current = adminState.handbook.isActive !== false;
    adminState.handbook.isActive = !current;
    updateLinkStatusUI(adminState.handbook.isActive);
    await autoSaveHandbook();
    showToast(adminState.handbook.isActive ? 'Link telah diaktifkan kembali.' : 'Link berhasil dinonaktifkan.');
  });

  DOM.btnConfirmPublish.addEventListener('click', async () => {
    adminState.handbook.readerPassword = DOM.readerPasswordInput.value.trim() || null;
    adminState.handbook.isPublished = true;
    await autoSaveHandbook();
    DOM.publishModal.style.display = 'none';
    showToast('Handbook berhasil dipublikasikan ke server!');
  });

  // Preview Modal events
  DOM.btnPreviewReader.addEventListener('click', openPreviewModal);
  DOM.btnClosePreviewModal.addEventListener('click', closePreviewModal);
  DOM.btnOpenPreviewTab.addEventListener('click', () => {
    window.open(`/read.html?id=${adminState.handbook.uniqueSlug}&preview=1`, '_blank');
  });
}

let toastTimeout = null;
function showToast(msg) {
  DOM.toast.textContent = msg;
  DOM.toast.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => DOM.toast.classList.remove('show'), 3000);
}

// Start Admin
initAdmin().catch(console.error);
