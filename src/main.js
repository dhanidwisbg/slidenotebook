// Handbook Flipbook - Main Application Orchestrator
// Complies with PRD Handbook Flipbook v1.0 specifications

import confetti from 'canvas-confetti';
import {
  openDB,
  getHandbookMeta,
  saveHandbookMeta,
  getPages,
  savePages,
  getMedia,
  saveMedia,
  clearAll
} from './db.js';
import {
  naturalSort,
  processImageFile,
  checkOrientationMismatch
} from './compressor.js';
import { convertPdfToPages } from './pdf-loader.js';
import { bgm } from './sound.js';
import { FlipbookManager } from './flipbook-manager.js';
import { generateSamplePages } from './sample-data.js';

// Application State
const state = {
  currentMode: 'edit', // 'edit' | 'reader'
  theme: localStorage.getItem('hfb_theme') || 'dark',
  handbook: {
    id: 'default',
    title: 'Handbook Budaya & Desain Sistem',
    subtitle: 'Panduan Operasional Tim Digital 2026',
    orientation: 'portrait', // 'portrait' | 'landscape'
    coverColor: '#1e293b',
    bgmPreset: 'lofi',
    soundEnabled: true,
    ambient: 'studio'
  },
  pages: [],
  flipbookManager: null,
  activeReaderPage: 0,
  draggedCardIndex: null
};

// DOM Elements
const DOM = {
  tabEdit: document.getElementById('tab-edit'),
  tabReader: document.getElementById('tab-reader'),
  editView: document.getElementById('edit-view'),
  readerView: document.getElementById('reader-view'),
  handbookTitle: document.getElementById('handbook-title'),
  handbookSubtitle: document.getElementById('handbook-subtitle'),
  btnOrientPortrait: document.getElementById('btn-orient-portrait'),
  btnOrientLandscape: document.getElementById('btn-orient-landscape'),
  swatchesContainer: document.getElementById('cover-color-swatches'),
  customColorPicker: document.getElementById('custom-color-picker'),
  bgmSelect: document.getElementById('bgm-select'),
  btnUploadAudio: document.getElementById('btn-upload-audio'),
  audioFileInput: document.getElementById('audio-file-input'),
  uploadZone: document.getElementById('upload-zone'),
  fileUploadInput: document.getElementById('file-upload-input'),
  btnAddMoreSlides: document.getElementById('btn-add-more-slides'),
  mismatchBanner: document.getElementById('orientation-mismatch-banner'),
  mismatchBannerText: document.getElementById('mismatch-banner-text'),
  btnFixOrient: document.getElementById('btn-fix-orient'),
  pagesGrid: document.getElementById('pages-grid'),
  pageCountBadge: document.getElementById('page-count-badge'),
  editBarSummary: document.getElementById('edit-bar-summary'),
  btnOpenReader: document.getElementById('btn-open-reader'),
  btnLoadSample: document.getElementById('btn-load-sample'),
  btnExportBackup: document.getElementById('btn-export-backup'),
  btnImportTrigger: document.getElementById('btn-import-trigger'),
  backupFileInput: document.getElementById('backup-file-input'),
  btnToggleTheme: document.getElementById('btn-toggle-theme'),
  bookBase: document.getElementById('book-base'),
  flipbookContainer: document.getElementById('flipbook-container'),
  readerAmbientSelect: document.getElementById('reader-ambient-select'),
  btnPrevPage: document.getElementById('btn-prev-page'),
  btnNextPage: document.getElementById('btn-next-page'),
  pageIndicator: document.getElementById('page-indicator'),
  btnToggleToc: document.getElementById('btn-toggle-toc'),
  btnToggleSound: document.getElementById('btn-toggle-sound'),
  btnToggleBgm: document.getElementById('btn-toggle-bgm'),
  bgmVolumeSlider: document.getElementById('bgm-volume-slider'),
  btnToggleFullscreen: document.getElementById('btn-toggle-fullscreen'),
  btnDockEdit: document.getElementById('btn-dock-edit'),
  thumbnailDrawer: document.getElementById('thumbnail-drawer'),
  btnCloseDrawer: document.getElementById('btn-close-drawer'),
  drawerThumbnailsTrack: document.getElementById('drawer-thumbnails-track'),
  toast: document.getElementById('toast-message')
};

// ============================================================================
// INITIALIZATION
// ============================================================================
async function initApp() {
  applyTheme(state.theme);

  // Initialize DB and load saved data
  await openDB();
  const savedMeta = await getHandbookMeta('default');
  if (savedMeta) {
    state.handbook = { ...state.handbook, ...savedMeta };
  }

  const savedPages = await getPages('default');
  if (savedPages && savedPages.length > 0) {
    state.pages = savedPages;
  } else {
    // Generate initial demo handbook so the user immediately gets a full experience
    state.pages = generateSamplePages(state.handbook.coverColor);
    await savePages('default', state.pages);
    await saveHandbookMeta(state.handbook);
  }

  // Load saved audio media if any
  const savedMedia = await getMedia('default');
  if (savedMedia && savedMedia.audioBlob) {
    bgm.setCustomAudio(savedMedia.audioBlob);
  }

  // Setup Flipbook Manager instance
  state.flipbookManager = new FlipbookManager(DOM.flipbookContainer, DOM.bookBase, {
    orientation: state.handbook.orientation,
    coverColor: state.handbook.coverColor,
    onPageChange: handleFlipbookPageChange,
    onInit: () => updatePageIndicator(0)
  });

  // Populate UI inputs
  syncMetaToInputs();
  renderPagesGrid();
  checkOrientationAlert();
  setupEventListeners();

  // Initialize BGM preset
  if (state.handbook.bgmPreset && state.handbook.bgmPreset !== 'custom') {
    bgm.loadPreset(state.handbook.bgmPreset);
  }

  showToast('Handbook siap digunakan! Klik "Buka di Mode Baca" untuk membaca.');
}

// ============================================================================
// UI SYNC & RENDERING
// ============================================================================
function syncMetaToInputs() {
  DOM.handbookTitle.value = state.handbook.title || '';
  DOM.handbookSubtitle.value = state.handbook.subtitle || '';

  // Orientation buttons
  if (state.handbook.orientation === 'landscape') {
    DOM.btnOrientLandscape.classList.add('active');
    DOM.btnOrientPortrait.classList.remove('active');
  } else {
    DOM.btnOrientPortrait.classList.add('active');
    DOM.btnOrientLandscape.classList.remove('active');
  }

  // Cover Color Swatches
  DOM.customColorPicker.value = state.handbook.coverColor || '#1e293b';
  DOM.swatchesContainer.querySelectorAll('.color-dot').forEach((dot) => {
    dot.classList.toggle('active', dot.dataset.color === state.handbook.coverColor);
  });
  if (state.flipbookManager) {
    state.flipbookManager.setCoverColor(state.handbook.coverColor);
  }

  // BGM Select
  DOM.bgmSelect.value = state.handbook.bgmPreset || 'lofi';
  DOM.btnUploadAudio.style.display = state.handbook.bgmPreset === 'custom' ? 'inline-flex' : 'none';

  // Ambient Environment
  document.body.dataset.ambient = state.handbook.ambient || 'studio';
  DOM.readerAmbientSelect.value = state.handbook.ambient || 'studio';

  updateSummaryBadges();
}

function updateSummaryBadges() {
  const count = state.pages.length;
  DOM.pageCountBadge.textContent = `${count} Halaman`;
  DOM.editBarSummary.textContent = `${count} halaman siap dibaca`;
}

/**
 * Renders the interactive grid of pages in Edit Mode (FR-8)
 */
function renderPagesGrid() {
  DOM.pagesGrid.innerHTML = '';
  updateSummaryBadges();

  state.pages.forEach((page, index) => {
    const isCover = index === 0;
    const isBackCover = index === state.pages.length - 1;
    const hasMismatch = checkOrientationMismatch(page, state.handbook.orientation);

    const card = document.createElement('div');
    card.className = `page-card ${state.handbook.orientation === 'landscape' ? 'landscape' : ''}`;
    card.draggable = true;
    card.dataset.index = index;

    let badgeText = '';
    if (isCover) badgeText = 'Sampul Depan';
    else if (isBackCover) badgeText = 'Sampul Belakang';

    card.innerHTML = `
      <div class="page-card-thumbnail-wrap" title="Tarik untuk memindahkan urutan">
        <img src="${page.dataUrl}" alt="${page.title}" class="page-card-thumbnail" loading="lazy" />
        ${badgeText ? `<div class="page-badge-cover">${badgeText}</div>` : ''}
        ${hasMismatch ? `<div class="page-card-warning-tag" title="Rasio halaman berbeda dari orientasi buku">⚠️ Rasio Beda</div>` : ''}
      </div>
      <div class="page-card-info">
        <input type="text" class="page-title-input" value="${page.title || `Halaman ${index + 1}`}" placeholder="Judul Halaman..." data-index="${index}" />
        <div class="page-card-footer">
          <span class="page-num-label">Hal ${index + 1} (${page.width}x${page.height}px)</span>
          <div class="page-actions-row">
            <button type="button" class="btn-card-action btn-move-left" title="Geser ke kiri / awal" data-index="${index}" ${index === 0 ? 'disabled style="opacity:0.3;"' : ''}>
              ◀
            </button>
            <button type="button" class="btn-card-action btn-move-right" title="Geser ke kanan / akhir" data-index="${index}" ${index === state.pages.length - 1 ? 'disabled style="opacity:0.3;"' : ''}>
              ▶
            </button>
            <button type="button" class="btn-card-action btn-delete" title="Hapus halaman" data-index="${index}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </div>
      </div>
    `;

    // Drag and Drop reordering events
    card.addEventListener('dragstart', (e) => {
      state.draggedCardIndex = index;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      state.draggedCardIndex = null;
    });

    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });

    card.addEventListener('drop', (e) => {
      e.preventDefault();
      const targetIndex = index;
      if (state.draggedCardIndex !== null && state.draggedCardIndex !== targetIndex) {
        reorderPage(state.draggedCardIndex, targetIndex);
      }
    });

    // Inline title edit
    const titleInput = card.querySelector('.page-title-input');
    titleInput.addEventListener('change', async (e) => {
      state.pages[index].title = e.target.value.trim();
      await savePages('default', state.pages);
      showToast('Judul halaman diperbarui.');
    });

    // Move left / right buttons
    card.querySelector('.btn-move-left').addEventListener('click', () => {
      if (index > 0) reorderPage(index, index - 1);
    });

    card.querySelector('.btn-move-right').addEventListener('click', () => {
      if (index < state.pages.length - 1) reorderPage(index, index + 1);
    });

    // Delete button
    card.querySelector('.btn-delete').addEventListener('click', async () => {
      if (confirm(`Hapus halaman "${page.title || index + 1}"?`)) {
        state.pages.splice(index, 1);
        await savePages('default', state.pages);
        renderPagesGrid();
        checkOrientationAlert();
        showToast('Halaman telah dihapus.');
      }
    });

    DOM.pagesGrid.appendChild(card);
  });
}

/**
 * Reorders a page from sourceIndex to targetIndex
 */
async function reorderPage(sourceIndex, targetIndex) {
  const item = state.pages.splice(sourceIndex, 1)[0];
  state.pages.splice(targetIndex, 0, item);
  await savePages('default', state.pages);
  renderPagesGrid();
  showToast('Urutan halaman berhasil diperbarui.');
}

/**
 * Checks for orientation mismatches (FR-4)
 */
function checkOrientationAlert() {
  if (state.pages.length === 0) {
    DOM.mismatchBanner.style.display = 'none';
    return;
  }

  const mismatchedCount = state.pages.filter((p) =>
    checkOrientationMismatch(p, state.handbook.orientation)
  ).length;

  if (mismatchedCount > 0) {
    DOM.mismatchBanner.style.display = 'flex';
    DOM.mismatchBannerText.textContent = `${mismatchedCount} gambar memiliki orientasi berbeda dari buku (${state.handbook.orientation}). Halaman tetap tampil rapi dengan ruang proporsional tanpa terdistorsi.`;
    DOM.btnFixOrient.textContent = `Ubah ke ${state.handbook.orientation === 'portrait' ? 'Landscape (16:9)' : 'Portrait (A-Series)'}`;
  } else {
    DOM.mismatchBanner.style.display = 'none';
  }
}

// ============================================================================
// FILE UPLOAD & PROCESSING (FR-1, FR-2, FR-15)
// ============================================================================
async function handleFilesUpload(files) {
  if (!files || files.length === 0) return;

  const fileList = Array.from(files);
  const images = [];
  const pdfs = [];

  fileList.forEach((file) => {
    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      pdfs.push(file);
    } else if (file.type.startsWith('image/')) {
      images.push(file);
    }
  });

  // Natural numeric sort for images (e.g. slide2.png before slide10.png)
  images.sort(naturalSort);

  showToast(`Memproses ${fileList.length} file...`);

  const newPages = [];

  // Process Images with client-side canvas compression (max 1800px)
  for (const imgFile of images) {
    try {
      const page = await processImageFile(imgFile, 1800, 0.88);
      newPages.push(page);
    } catch (err) {
      console.error(err);
      showToast(`Gagal memuat ${imgFile.name}: ${err.message}`);
    }
  }

  // Process PDFs
  for (const pdfFile of pdfs) {
    try {
      showToast(`Mengekstrak halaman PDF: ${pdfFile.name}...`);
      const extractedPages = await convertPdfToPages(pdfFile, (curr, total) => {
        DOM.editBarSummary.textContent = `Mengekstrak PDF: ${curr}/${total} halaman...`;
      });
      newPages.push(...extractedPages);
    } catch (err) {
      console.error(err);
      showToast(`Gagal membaca PDF ${pdfFile.name}: ${err.message}`);
    }
  }

  if (newPages.length === 0) return;

  // Auto-detect orientation from the first image if handbook has no pages yet (FR-3)
  if (state.pages.length === 0 && newPages[0]) {
    state.handbook.orientation = newPages[0].orientation;
    syncMetaToInputs();
  }

  state.pages.push(...newPages);
  await savePages('default', state.pages);
  await saveHandbookMeta(state.handbook);

  renderPagesGrid();
  checkOrientationAlert();
  showToast(`Berhasil menambahkan ${newPages.length} halaman.`);
}

// ============================================================================
// MODE SWITCHING & READER CONTROLS
// ============================================================================
async function switchMode(mode) {
  state.currentMode = mode;

  if (mode === 'edit') {
    DOM.tabEdit.classList.add('active');
    DOM.tabReader.classList.remove('active');
    DOM.editView.style.display = 'block';
    DOM.readerView.style.display = 'none';
    closeThumbnailDrawer();
  } else {
    if (state.pages.length === 0) {
      showToast('Belum ada halaman! Silakan unggah gambar atau muat contoh.');
      return;
    }

    DOM.tabReader.classList.add('active');
    DOM.tabEdit.classList.remove('active');
    DOM.editView.style.display = 'none';
    DOM.readerView.style.display = 'flex';

    // Start background music on entering reader
    if (state.handbook.bgmPreset && state.handbook.bgmPreset !== 'none') {
      bgm.play();
    }

    // Load flipbook pages
    await state.flipbookManager.loadBook(
      state.pages,
      state.handbook.orientation,
      state.activeReaderPage
    );

    renderThumbnailsDrawer();
  }
}

function handleFlipbookPageChange({ pageIndex, totalPages, isCover, isBackCover }) {
  state.activeReaderPage = pageIndex;
  updatePageIndicator(pageIndex);
  highlightActiveThumbnail(pageIndex);

  // Confetti celebration on reaching the back cover!
  if (isBackCover && totalPages > 1) {
    confetti({
      particleCount: 60,
      spread: 70,
      origin: { y: 0.6 }
    });
  }
}

function updatePageIndicator(pageIndex) {
  const total = state.pages.length;
  if (total === 0) {
    DOM.pageIndicator.textContent = 'Kosong';
    return;
  }

  if (pageIndex === 0) {
    DOM.pageIndicator.textContent = 'Sampul Depan';
  } else if (pageIndex >= total - 1) {
    DOM.pageIndicator.textContent = 'Sampul Belakang';
  } else {
    const isMobile = window.innerWidth < 768;

    if (isMobile) {
      DOM.pageIndicator.textContent = `Halaman ${pageIndex + 1} dari ${total}`;
    } else {
      const leftPage = pageIndex;
      const rightPage = Math.min(leftPage + 1, total - 1);
      DOM.pageIndicator.textContent = `Halaman ${leftPage} - ${rightPage} dari ${total}`;
    }
  }
}

/**
 * Slide-up Thumbnail Drawer (FR-10)
 */
function renderThumbnailsDrawer() {
  DOM.drawerThumbnailsTrack.innerHTML = '';

  state.pages.forEach((page, index) => {
    const thumbItem = document.createElement('div');
    thumbItem.className = `thumb-item ${index === state.activeReaderPage ? 'active' : ''}`;
    thumbItem.dataset.page = index;

    thumbItem.innerHTML = `
      <div class="thumb-img-wrap">
        <img src="${page.dataUrl}" alt="${page.title}" class="thumb-img" loading="lazy" />
      </div>
      <span class="thumb-label">${index === 0 ? 'Sampul' : `Hal ${index + 1}`}</span>
    `;

    thumbItem.addEventListener('click', () => {
      state.flipbookManager.goToPage(index);
      closeThumbnailDrawer();
    });

    DOM.drawerThumbnailsTrack.appendChild(thumbItem);
  });
}

function highlightActiveThumbnail(pageIndex) {
  DOM.drawerThumbnailsTrack.querySelectorAll('.thumb-item').forEach((item) => {
    item.classList.toggle('active', parseInt(item.dataset.page, 10) === pageIndex);
  });
}

function toggleThumbnailDrawer() {
  DOM.thumbnailDrawer.classList.toggle('open');
}

function closeThumbnailDrawer() {
  DOM.thumbnailDrawer.classList.remove('open');
}

// ============================================================================
// BACKUP & RESTORE (FR-16)
// ============================================================================
async function exportHandbookBackup() {
  const data = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    handbook: state.handbook,
    pages: state.pages
  };

  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `Handbook_${(state.handbook.title || 'Flipbook').replace(/\s+/g, '_')}_backup.json`;
  a.click();
  URL.revokeObjectURL(url);

  showToast('Cadangan handbook berhasil diunduh.');
}

async function importHandbookBackup(file) {
  try {
    const text = await file.text();
    const data = JSON.parse(text);

    if (!data.pages || !Array.isArray(data.pages)) {
      throw new Error('Format file cadangan tidak valid.');
    }

    if (data.handbook) {
      state.handbook = { ...state.handbook, ...data.handbook };
    }
    state.pages = data.pages;

    await saveHandbookMeta(state.handbook);
    await savePages('default', state.pages);

    syncMetaToInputs();
    renderPagesGrid();
    checkOrientationAlert();

    showToast(`Berhasil memulihkan ${state.pages.length} halaman handbook!`);
  } catch (err) {
    showToast(`Gagal mengimpor cadangan: ${err.message}`);
  }
}

// ============================================================================
// THEME & TOAST
// ============================================================================
function applyTheme(theme) {
  state.theme = theme;
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('hfb_theme', theme);
}

function toggleTheme() {
  const newTheme = state.theme === 'dark' ? 'light' : 'dark';
  applyTheme(newTheme);
}

let toastTimeout = null;
function showToast(message) {
  DOM.toast.textContent = message;
  DOM.toast.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    DOM.toast.classList.remove('show');
  }, 3200);
}

// ============================================================================
// EVENT LISTENERS SETUP
// ============================================================================
function setupEventListeners() {
  // Navigation mode tabs
  DOM.tabEdit.addEventListener('click', () => switchMode('edit'));
  DOM.tabReader.addEventListener('click', () => switchMode('reader'));
  DOM.btnOpenReader.addEventListener('click', () => switchMode('reader'));
  DOM.btnDockEdit.addEventListener('click', () => switchMode('edit'));

  // Handbook Title & Subtitle changes
  DOM.handbookTitle.addEventListener('change', async (e) => {
    state.handbook.title = e.target.value.trim();
    await saveHandbookMeta(state.handbook);
  });
  DOM.handbookSubtitle.addEventListener('change', async (e) => {
    state.handbook.subtitle = e.target.value.trim();
    await saveHandbookMeta(state.handbook);
  });

  // Orientation toggle (FR-3)
  DOM.btnOrientPortrait.addEventListener('click', async () => {
    state.handbook.orientation = 'portrait';
    syncMetaToInputs();
    renderPagesGrid();
    checkOrientationAlert();
    await saveHandbookMeta(state.handbook);
    showToast('Orientasi diubah ke Portrait (A-Series).');
  });

  DOM.btnOrientLandscape.addEventListener('click', async () => {
    state.handbook.orientation = 'landscape';
    syncMetaToInputs();
    renderPagesGrid();
    checkOrientationAlert();
    await saveHandbookMeta(state.handbook);
    showToast('Orientasi diubah ke Landscape (16:9).');
  });

  DOM.btnFixOrient.addEventListener('click', async () => {
    state.handbook.orientation = state.handbook.orientation === 'portrait' ? 'landscape' : 'portrait';
    syncMetaToInputs();
    renderPagesGrid();
    checkOrientationAlert();
    await saveHandbookMeta(state.handbook);
  });

  // Color Swatches (FR-7)
  DOM.swatchesContainer.querySelectorAll('.color-dot').forEach((dot) => {
    dot.addEventListener('click', async () => {
      const color = dot.dataset.color;
      state.handbook.coverColor = color;
      syncMetaToInputs();
      await saveHandbookMeta(state.handbook);
    });
  });

  DOM.customColorPicker.addEventListener('input', async (e) => {
    state.handbook.coverColor = e.target.value;
    syncMetaToInputs();
    await saveHandbookMeta(state.handbook);
  });

  // Background Music selector (FR-11)
  DOM.bgmSelect.addEventListener('change', async (e) => {
    const val = e.target.value;
    state.handbook.bgmPreset = val;
    DOM.btnUploadAudio.style.display = val === 'custom' ? 'inline-flex' : 'none';

    if (val === 'custom') {
      DOM.audioFileInput.click();
    } else {
      bgm.loadPreset(val);
    }
    await saveHandbookMeta(state.handbook);
  });

  DOM.btnUploadAudio.addEventListener('click', () => DOM.audioFileInput.click());

  DOM.audioFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 12 * 1024 * 1024) {
      alert('Ukuran file audio melebihi batas maksimal 12 MB.');
      return;
    }

    showToast(`Mengunggah musik: ${file.name}`);
    bgm.setCustomAudio(file);
    state.handbook.bgmPreset = 'custom';
    DOM.bgmSelect.value = 'custom';

    await saveMedia('default', {
      audioBlob: file,
      audioName: file.name,
      audioSize: file.size
    });
    await saveHandbookMeta(state.handbook);
    showToast('Musik latar berhasil disimpan.');
  });

  // Drag & drop upload zone
  DOM.uploadZone.addEventListener('click', () => DOM.fileUploadInput.click());
  DOM.btnAddMoreSlides.addEventListener('click', () => DOM.fileUploadInput.click());

  DOM.fileUploadInput.addEventListener('change', (e) => {
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

  // Reader Controls
  DOM.btnPrevPage.addEventListener('click', () => state.flipbookManager.prev());
  DOM.btnNextPage.addEventListener('click', () => state.flipbookManager.next());
  DOM.btnToggleToc.addEventListener('click', toggleThumbnailDrawer);
  DOM.btnCloseDrawer.addEventListener('click', closeThumbnailDrawer);

  // Sound toggle (FR-17)
  DOM.btnToggleSound.addEventListener('click', () => {
    state.handbook.soundEnabled = !state.handbook.soundEnabled;
    state.flipbookManager.setSoundEnabled(state.handbook.soundEnabled);
    DOM.btnToggleSound.classList.toggle('active', state.handbook.soundEnabled);
    showToast(state.handbook.soundEnabled ? 'Suara kertas diaktifkan' : 'Suara kertas dimatikan');
  });

  // BGM Toggle & Volume (FR-11)
  DOM.btnToggleBgm.addEventListener('click', () => {
    const isPlaying = bgm.toggle();
    DOM.btnToggleBgm.classList.toggle('active', isPlaying);
  });

  DOM.bgmVolumeSlider.addEventListener('input', (e) => {
    bgm.setVolume(parseFloat(e.target.value));
  });

  // Reader Ambient environment
  DOM.readerAmbientSelect.addEventListener('change', async (e) => {
    state.handbook.ambient = e.target.value;
    document.body.dataset.ambient = e.target.value;
    await saveHandbookMeta(state.handbook);
  });

  // Fullscreen
  DOM.btnToggleFullscreen.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  });

  // Demo Sample Handbook Generator
  DOM.btnLoadSample.addEventListener('click', async () => {
    if (confirm('Muat contoh handbook? Ini akan menggantikan susunan halaman saat ini.')) {
      state.pages = generateSamplePages(state.handbook.coverColor);
      await savePages('default', state.pages);
      renderPagesGrid();
      checkOrientationAlert();
      showToast('Contoh Handbook berhasil dimuat.');
    }
  });

  // Backup & Restore
  DOM.btnExportBackup.addEventListener('click', exportHandbookBackup);
  DOM.btnImportTrigger.addEventListener('click', () => DOM.backupFileInput.click());
  DOM.backupFileInput.addEventListener('change', (e) => {
    if (e.target.files[0]) {
      importHandbookBackup(e.target.files[0]);
      e.target.value = '';
    }
  });

  // Theme toggle
  DOM.btnToggleTheme.addEventListener('click', toggleTheme);

  // Keyboard navigation (FR-5, FR-10)
  window.addEventListener('keydown', (e) => {
    if (state.currentMode !== 'reader') return;

    if (e.key === 'ArrowRight' || e.key === ' ') {
      e.preventDefault();
      state.flipbookManager.next();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      state.flipbookManager.prev();
    } else if (e.key === 'f' || e.key === 'F') {
      DOM.btnToggleFullscreen.click();
    } else if (e.key === 'm' || e.key === 'M') {
      DOM.btnToggleBgm.click();
    } else if (e.key === 'Escape') {
      closeThumbnailDrawer();
    }
  });
}

// Start application
initApp().catch(console.error);
