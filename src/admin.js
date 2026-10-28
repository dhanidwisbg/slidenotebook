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
  uploadPageImageToBlob,
  convertAdminPptx,
  deleteAdminHandbook
} from './api.js';
import {
  naturalSort,
  processImageFile,
  checkOrientationMismatch
} from './compressor.js';
import { convertPdfToPages } from './pdf-loader.js';
import { generateSamplePages } from './sample-data.js';
import { initBlendBackground } from './blend-retro.js';

// Initialize animated Untitled Blend (1) background
if (typeof document !== 'undefined') {
  initBlendBackground('blend-bg-canvas');
}

// Admin State
const adminState = {
  user: null,
  handbook: null,         // active handbook object from server
  handbooks: [],          // all handbooks list (summaries)
  draggedCardIndex: null
};

// DOM references
const DOM = {
  loginScreen: document.getElementById('login-screen'),
  loginForm: document.getElementById('login-form'),
  loginPasscode: document.getElementById('login-passcode'),
  loginError: document.getElementById('login-error'),
  adminMain: document.getElementById('admin-main'),
  adminUserEmail: document.getElementById('admin-user-email'),
  btnLogout: document.getElementById('btn-logout'),
  btnLoginTheme: document.getElementById('btn-login-theme'),
  btnAdminTheme: document.getElementById('btn-admin-theme'),

  // Metadata
  hbTitle: document.getElementById('hb-title'),
  hbSubtitle: document.getElementById('hb-subtitle'),
  btnOrientPort: document.getElementById('btn-orient-port'),
  btnOrientLand: document.getElementById('btn-orient-land'),
  swatches: document.getElementById('admin-color-swatches'),
  customColor: document.getElementById('admin-custom-color'),


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

  // Handbook List Panel
  hbTotalCount: document.getElementById('hb-total-count'),
  hbList: document.getElementById('admin-hb-list'),
  btnNewHandbook: document.getElementById('btn-new-handbook'),

  // Publish Modal extras
  directLinkInput: document.getElementById('direct-link-input'),
  btnCopyDirectLink: document.getElementById('btn-copy-direct-link'),
  directLinkGroup: document.getElementById('direct-link-group'),

  // Upload Loading Card & Success Modal
  uploadLoadingModal: document.getElementById('upload-loading-modal'),
  loadingCardTitle: document.getElementById('loading-card-title'),
  loadingCardDesc: document.getElementById('loading-card-desc'),
  loadingCardProgress: document.getElementById('loading-card-progress'),
  loadingCardStep: document.getElementById('loading-card-step'),
  loadingCardPercent: document.getElementById('loading-card-percent'),
  loadingCardFilename: document.getElementById('loading-card-filename'),
  loadingIconCore: document.getElementById('loading-icon-core'),

  uploadSuccessModal: document.getElementById('upload-success-modal'),
  successCardTitle: document.getElementById('success-card-title'),
  successCardDesc: document.getElementById('success-card-desc'),
  successCardDetails: document.getElementById('success-card-details'),
  successCardDetailText: document.getElementById('success-card-detail-text'),
  btnCloseSuccessModal: document.getElementById('btn-close-success-modal'),

  toast: document.getElementById('admin-toast')
};

// ============================================================================
// UPLOAD LOADING CARD & SUCCESS NOTIFICATION HELPERS
// ============================================================================
function showLoadingCard({ title, subtitle, filename, percent = 0, step = 'Menyiapkan berkas...' }) {
  if (!DOM.uploadLoadingModal) return;

  DOM.loadingCardTitle.textContent = title;
  DOM.loadingCardDesc.textContent = subtitle;
  DOM.loadingCardFilename.textContent = filename || 'Berkas';
  DOM.loadingCardProgress.style.width = `${percent}%`;
  DOM.loadingCardPercent.textContent = `${Math.round(percent)}%`;
  DOM.loadingCardStep.textContent = step;

  if (DOM.loadingIconCore) {  }

  DOM.uploadLoadingModal.style.display = 'flex';
}

function updateLoadingCard({ percent, step, title, subtitle }) {
  if (percent !== undefined && DOM.loadingCardProgress) {
    const clamped = Math.min(100, Math.max(0, percent));
    DOM.loadingCardProgress.style.width = `${clamped}%`;
    if (DOM.loadingCardPercent) DOM.loadingCardPercent.textContent = `${Math.round(clamped)}%`;
  }
  if (step && DOM.loadingCardStep) {
    DOM.loadingCardStep.textContent = step;
  }
  if (title && DOM.loadingCardTitle) {
    DOM.loadingCardTitle.textContent = title;
  }
  if (subtitle && DOM.loadingCardDesc) {
    DOM.loadingCardDesc.textContent = subtitle;
  }
}

function hideLoadingCard() {
  if (DOM.uploadLoadingModal) {
    DOM.uploadLoadingModal.style.display = 'none';
  }
}

function showSuccessModal({ title, message, detailText }) {
  hideLoadingCard();
  if (DOM.uploadSuccessModal) {
    DOM.successCardTitle.textContent = title || 'Berhasil Diunggah!';
    DOM.successCardDesc.textContent = message || 'Berkas Anda telah berhasil diproses dan disimpan ke sistem.';
    if (detailText) {
      DOM.successCardDetailText.textContent = detailText;
      DOM.successCardDetails.style.display = 'flex';
    } else {
      DOM.successCardDetails.style.display = 'none';
    }
    DOM.uploadSuccessModal.style.display = 'flex';
  }
}

// ============================================================================
// INITIALIZATION & AUTH CHECK
// ============================================================================
async function initAdmin() {
  const savedTheme = localStorage.getItem('hfb_theme') || 'dark';
  syncAdminTheme(savedTheme);

  const auth = await checkAdminAuth();
  if (!auth.authenticated) {
    showLogin();
  } else {
    adminState.user = auth.user;
    showDashboard();
  }

  setupEventListeners();
}

function syncAdminTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const sunSvg = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="5"></circle>
      <line x1="12" y1="1" x2="12" y2="3"></line>
      <line x1="12" y1="21" x2="12" y2="23"></line>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
      <line x1="1" y1="12" x2="3" y2="12"></line>
      <line x1="21" y1="12" x2="23" y2="12"></line>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
    </svg>
  `;
  const moonSvg = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
    </svg>
  `;
  const html = theme === 'light' ? moonSvg : sunSvg;
  const title = theme === 'light' ? 'Beralih ke Mode Gelap' : 'Beralih ke Mode Terang';

  if (DOM.btnLoginTheme) {
    DOM.btnLoginTheme.innerHTML = html;
    DOM.btnLoginTheme.title = title;
  }
  if (DOM.btnAdminTheme) {
    DOM.btnAdminTheme.innerHTML = html;
    DOM.btnAdminTheme.title = title;
  }
}

function toggleAdminTheme() {
  const current = document.documentElement.dataset.theme;
  const next = current === 'dark' ? 'light' : 'dark';
  localStorage.setItem('hfb_theme', next);
  syncAdminTheme(next);
}

function showLogin() {
  DOM.loginScreen.style.display = 'flex';
  DOM.adminMain.style.display = 'none';
}

async function showDashboard() {
  DOM.loginScreen.style.display = 'none';
  DOM.adminMain.style.display = 'block';
  DOM.adminUserEmail.textContent = adminState.user.email;

  await loadHandbookList();
}

// Load all handbooks and select the first one (or last active one)
async function loadHandbookList() {
  try {
    const list = await fetchAdminHandbooks();
    adminState.handbooks = list || [];

    if (adminState.handbooks.length === 0) {
      // Create initial demo handbook on server
      const initialPages = generateSamplePages('#1e293b');
      const newHb = await createAdminHandbook({
        title: 'Handbook Budaya & Desain Sistem',
        subtitle: 'Panduan Operasional Tim Digital 2026',
        orientation: 'portrait',
        coverColor: '#1e293b',
        pages: initialPages,
        isPublished: true,
        isActive: true,
        readerPassword: null
      });
      adminState.handbooks = [newHb];
    }

    renderHandbookList();

    // Select the active handbook or first
    const activeId = localStorage.getItem('hfb_active_handbook_id');
    const target = adminState.handbooks.find(h => h.id === activeId) || adminState.handbooks[0];
    await selectHandbook(target.id);
  } catch (err) {
    showToast(`Error memuat daftar handbook: ${err.message}`);
  }
}

function renderHandbookList() {
  const list = adminState.handbooks;
  if (DOM.hbTotalCount) DOM.hbTotalCount.textContent = list.length;
  if (!DOM.hbList) return;

  DOM.hbList.innerHTML = '';

  list.forEach(hb => {
    const item = document.createElement('div');
    item.className = `admin-hb-item${adminState.handbook?.id === hb.id ? ' active' : ''}`;
    item.dataset.id = hb.id;

    const lockIcon = hb.hasPassword
      ? `<svg class="admin-hb-item-lock" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`
      : '';

    item.innerHTML = `
      ${lockIcon}
      <span class="admin-hb-item-name" title="${hb.title}">${hb.title || 'Untitled'}</span>
      <div class="admin-hb-item-actions">
        <a href="/read.html?id=${hb.uniqueSlug || hb.id}" target="_blank" class="admin-hb-item-btn admin-hb-item-view" title="Buka Pembaca di Tab Baru">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
        </a>
        <button class="admin-hb-item-btn admin-hb-item-delete" title="Hapus Handbook" aria-label="Hapus Handbook" data-id="${hb.id}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    `;

    // Click the item body area (not actions) to select
    item.addEventListener('click', async (e) => {
      if (e.target.closest('.admin-hb-item-actions')) return;
      await selectHandbook(hb.id);
    });

    // Delete button: langsung hapus + toast "Batalkan" 6 detik sebelum dianggap final
    item.querySelector('.admin-hb-item-delete').addEventListener('click', async (e) => {
      e.stopPropagation();
      let snapshot = null;
      try {
        // Simpan snapshot untuk undo (pages ber-imageUrl lolos tanpa re-upload)
        snapshot = await fetchAdminHandbook(hb.id);
        await deleteAdminHandbook(hb.id);
        adminState.handbooks = adminState.handbooks.filter(h => h.id !== hb.id);
        if (adminState.handbook?.id === hb.id) {
          adminState.handbook = null;
        }

        if (adminState.handbooks.length === 0) {
          await loadHandbookList(); // creates a default
        } else {
          renderHandbookList();
          if (!adminState.handbook) {
            await selectHandbook(adminState.handbooks[0].id);
          }
        }

        showUndoToast(
          `Handbook "${hb.title || 'Untitled'}" dihapus.`,
          async () => {
            try {
              const restored = await createAdminHandbook({
                title: snapshot.title,
                subtitle: snapshot.subtitle,
                orientation: snapshot.orientation,
                coverColor: snapshot.coverColor,
                pages: snapshot.pages || [],
                readerPassword: snapshot.readerPassword || null
              });
              await loadHandbookList();
              if (restored?.id) await selectHandbook(restored.id);
            } catch (err) {
              showToast(`Gagal memulihkan: ${err.message}`);
            }
          }
        );
      } catch (err) {
        showToast(`Gagal menghapus: ${err.message}`);
      }
    });

    DOM.hbList.appendChild(item);
  });
}

async function selectHandbook(id) {
  try {
    adminState.handbook = await fetchAdminHandbook(id);
    localStorage.setItem('hfb_active_handbook_id', id);
    syncHandbookToUI();
    renderPagesGrid();
    checkOrientationAlert();
    renderHandbookList(); // refresh active state
  } catch (err) {
    showToast(`Gagal memuat handbook: ${err.message}`);
  }
}

async function createNewHandbook() {
  const title = prompt('Nama handbook baru:');
  if (!title || !title.trim()) return;
  try {
    showToast('Membuat handbook baru...');
    const newHb = await createAdminHandbook({
      title: title.trim(),
      subtitle: '',
      orientation: 'portrait',
      coverColor: '#1e293b',
      pages: [],
      isPublished: true,
      isActive: true,
      readerPassword: null
    });
    adminState.handbooks.unshift(newHb);
    await selectHandbook(newHb.id);
    showToast(`Handbook "${title.trim()}" berhasil dibuat!`);
  } catch (err) {
    showToast(`Gagal membuat handbook: ${err.message}`);
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
        <img src="${page.imageUrl || page.dataUrl}" alt="${page.title}" class="page-card-thumbnail" loading="lazy" />
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

  const primaryFilename = fileList[0]?.name || 'Berkas';
  const fileSummary = fileList.length === 1 ? primaryFilename : `${primaryFilename} + ${fileList.length - 1} berkas lainnya`;

  showLoadingCard({
    title: 'Memproses Slide...',
    subtitle: `Sedang memproses ${fileList.length} file berkas presentasi dan gambar ke dalam buku flipbook.`,
    filename: fileSummary,
    percent: 8,
    step: 'Menganalisis berkas yang dipilih...',
  });

  try {
    const newPages = [];

    // 1. Process PowerPoint (.pptx / .ppt) via Server Native PowerPoint Conversion
    for (let i = 0; i < ppts.length; i++) {
      const pptFile = ppts[i];
      try {
        updateLoadingCard({
          percent: 15 + Math.round((i / ppts.length) * 25),
          step: `Mengonversi presentasi PowerPoint: ${pptFile.name}...`
        });
        const convertRes = await convertAdminPptx(pptFile);

        updateLoadingCard({
          step: `Mengekstrak slide dari PowerPoint: ${pptFile.name}...`
        });

        const pdfBlob = await fetch(convertRes.pdfUrl).then((r) => r.blob());
        const extracted = await convertPdfToPages(pdfBlob, (current, total) => {
          updateLoadingCard({
            step: `Mengekstrak slide ${current} dari ${total} (${pptFile.name})...`
          });
        });
        newPages.push(...extracted);
      } catch (err) {
        console.error(err);
        alert(`⚠️ ${err.message}\n\n💡 Alternatif Praktis: Buka file presentasi Anda di PowerPoint, lalu pilih "File > Export / Save As > PDF", kemudian tarik file PDF tersebut ke sini!`);
      }
    }

    // 2. Compress images to max 1600 px
    for (let i = 0; i < images.length; i++) {
      const imgFile = images[i];
      try {
        const pct = 40 + Math.round((i / Math.max(1, images.length)) * 25);
        updateLoadingCard({
          percent: Math.min(68, pct),
          step: `Mengompresi gambar (${i + 1}/${images.length}): ${imgFile.name}...`
        });
        const page = await processImageFile(imgFile, 1600, 0.82);
        newPages.push(page);
      } catch (err) {
        console.error(err);
        showToast(`Gagal memuat ${imgFile.name}: ${err.message}`);
      }
    }

    // 3. Extract PDF documents
    for (let i = 0; i < pdfs.length; i++) {
      const pdfFile = pdfs[i];
      try {
        updateLoadingCard({
          percent: 50 + Math.round((i / Math.max(1, pdfs.length)) * 20),
          step: `Mengekstrak dokumen PDF: ${pdfFile.name}...`
        });
        const extracted = await convertPdfToPages(pdfFile, (current, total) => {
          updateLoadingCard({
            step: `Mengekstrak slide ${current} dari ${total} (${pdfFile.name})...`
          });
        });
        newPages.push(...extracted);
      } catch (err) {
        console.error(err);
        showToast(`Gagal membaca PDF: ${err.message}`);
      }
    }

    if (newPages.length === 0) {
      hideLoadingCard();
      return;
    }

    // Auto-detect orientation from first slide if no pages yet
    if ((adminState.handbook.pages || []).length === 0 && newPages[0]) {
      adminState.handbook.orientation = newPages[0].orientation;
      syncHandbookToUI();
    }

    // ── Upload each new page image to Vercel Blob (one request per image) ──────
    const handbookId = adminState.handbook.id;
    let blobUploaded = 0;

    for (let i = 0; i < newPages.length; i++) {
      const page = newPages[i];
      if (page.dataUrl && page.dataUrl.startsWith('data:image/')) {
        const uploadPct = 70 + Math.round((i / newPages.length) * 22);
        updateLoadingCard({
          percent: uploadPct,
          step: `Mengunggah slide ${i + 1} dari ${newPages.length} ke cloud storage...`
        });
        const blobUrl = await uploadPageImageToBlob(handbookId, page.id, page.dataUrl);
        if (blobUrl) {
          page.imageUrl = blobUrl;
          delete page.dataUrl; // remove heavy base64
          blobUploaded++;
        }
      }
    }

    adminState.handbook.pages = adminState.handbook.pages || [];
    adminState.handbook.pages.push(...newPages);

    updateLoadingCard({
      percent: 96,
      step: `Menyimpan metadata ${newPages.length} slide ke database...`
    });

    await autoSaveHandbook();
    renderPagesGrid();
    checkOrientationAlert();

    updateLoadingCard({
      percent: 100,
      step: 'Semua proses selesai!'
    });

    setTimeout(() => {
      showSuccessModal({
        title: 'Slide Berhasil Ditambahkan!',
        message: `Sebanyak ${newPages.length} slide baru berhasil diproses dan disimpan ke server.`,
        detailText: `Total halaman saat ini: ${adminState.handbook.pages.length} halaman.`
      });
    }, 350);

  } catch (err) {
    hideLoadingCard();
    console.error('Files upload error:', err);
    alert(`Terjadi kesalahan saat memproses file: ${err.message}`);
  }
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

  // Build direct access link with key bypass
  const accessKey = hb.accessKey || hb.uniqueSlug;
  const directUrl = `${window.location.origin}/read.html?id=${hb.uniqueSlug}&key=${accessKey}`;
  if (DOM.directLinkInput) DOM.directLinkInput.value = directUrl;

  // Show/hide direct link section
  if (DOM.directLinkGroup) {
    DOM.directLinkGroup.style.display = (hb.readerPassword && hb.readerPassword.trim()) ? 'block' : 'none';
  }

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
      const passcode = DOM.loginPasscode.value.trim();
      const res = await loginAdmin(passcode);
      adminState.user = res.user;
      showToast('Login berhasil!');
      await showDashboard();
    } catch (err) {
      DOM.loginError.textContent = err.message || 'Kode akses admin salah. Silakan masukkan 12345678.';
      DOM.loginError.style.display = 'block';
    }
  });

  // Toggle Login Passcode Visibility
  const btnToggleLoginPwd = document.getElementById('btn-toggle-login-pwd');
  if (btnToggleLoginPwd && DOM.loginPasscode) {
    btnToggleLoginPwd.addEventListener('click', () => {
      const isPwd = DOM.loginPasscode.type === 'password';
      DOM.loginPasscode.type = isPwd ? 'text' : 'password';
      btnToggleLoginPwd.innerHTML = isPwd ? `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
          <line x1="1" y1="1" x2="23" y2="23"></line>
        </svg>
      ` : `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
      `;
    });
  }

  // Theme Toggles
  if (DOM.btnLoginTheme) DOM.btnLoginTheme.addEventListener('click', toggleAdminTheme);
  if (DOM.btnAdminTheme) DOM.btnAdminTheme.addEventListener('click', toggleAdminTheme);

  // New Handbook button
  if (DOM.btnNewHandbook) DOM.btnNewHandbook.addEventListener('click', createNewHandbook);

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

  DOM.readerPasswordInput.addEventListener('input', () => {
    const val = DOM.readerPasswordInput.value.trim();
    if (DOM.directLinkGroup) {
      DOM.directLinkGroup.style.display = val ? 'block' : 'none';
    }
  });

  DOM.btnCopyPublicLink.addEventListener('click', () => {
    navigator.clipboard.writeText(DOM.publicLinkInput.value).then(() => {
      showToast('Link berhasil disalin ke clipboard!');
      DOM.btnCopyPublicLink.textContent = 'Tersalin!';
      setTimeout(() => (DOM.btnCopyPublicLink.textContent = 'Salin Link'), 2000);
    });
  });

  if (DOM.btnCopyDirectLink) {
    DOM.btnCopyDirectLink.addEventListener('click', () => {
      navigator.clipboard.writeText(DOM.directLinkInput.value).then(() => {
        showToast('Link direct berhasil disalin!');
        const span = DOM.btnCopyDirectLink.querySelector('span');
        if (span) span.textContent = 'Tersalin!';
        setTimeout(() => { if (span) span.textContent = 'Salin'; }, 2000);
      });
    });
  }

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
    // Refresh handbooks list to reflect password change
    adminState.handbooks = adminState.handbooks.map(h =>
      h.id === adminState.handbook.id ? { ...h, hasPassword: !!(adminState.handbook.readerPassword) } : h
    );
    renderHandbookList();
    // Update direct link visibility
    if (DOM.directLinkGroup) {
      DOM.directLinkGroup.style.display = (adminState.handbook.readerPassword) ? 'block' : 'none';
    }
    DOM.publishModal.style.display = 'none';
    showToast('Handbook berhasil dipublikasikan ke server!');
  });

  // Preview Modal events
  DOM.btnPreviewReader.addEventListener('click', openPreviewModal);
  DOM.btnClosePreviewModal.addEventListener('click', closePreviewModal);
  DOM.btnOpenPreviewTab.addEventListener('click', () => {
    window.open(`/read.html?id=${adminState.handbook.uniqueSlug}&preview=1`, '_blank');
  });

  // Success Modal Dismiss
  if (DOM.btnCloseSuccessModal) {
    DOM.btnCloseSuccessModal.addEventListener('click', () => {
      DOM.uploadSuccessModal.style.display = 'none';
    });
  }
  if (DOM.uploadSuccessModal) {
    DOM.uploadSuccessModal.addEventListener('click', (e) => {
      if (e.target === DOM.uploadSuccessModal) {
        DOM.uploadSuccessModal.style.display = 'none';
      }
    });
  }
}

let toastTimeout = null;
function showToast(msg) {
  DOM.toast.textContent = msg;
  DOM.toast.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => DOM.toast.classList.remove('show'), 3000);
}

// Toast dengan aksi Batalkan (undo) untuk penghapusan handbook
function showUndoToast(msg, onUndo) {
  DOM.toast.innerHTML = '';
  const span = document.createElement('span');
  span.textContent = msg;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = 'Batalkan';
  btn.style.cssText = 'background:none;border:none;color:var(--accent-primary);font-weight:700;cursor:pointer;font-size:0.85rem;padding:0.15rem 0.4rem;text-decoration:underline;';
  btn.addEventListener('click', () => {
    clearTimeout(toastTimeout);
    DOM.toast.classList.remove('show');
    onUndo();
  });
  DOM.toast.append(span, btn);
  DOM.toast.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => DOM.toast.classList.remove('show'), 6000);
}

// Start Admin
initAdmin().catch(console.error);
