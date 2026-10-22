// Pure Reader Script - Handbook Flipbook
// Zero editor code included. Read-only viewer.

import confetti from 'canvas-confetti';
import { fetchPublicHandbook } from './api.js';
import { FlipbookManager } from './flipbook-manager.js';

// Reader State
const readerState = {
  slugOrId: null,
  handbook: null,
  password: null,
  flipbookManager: null,
  soundEnabled: true,
  audioElement: new Audio(),
  audioPlaying: false,
  hasTouchedFirstTime: false
};

// DOM references
const DOM = {
  readerTopBar: document.getElementById('reader-top-bar'),
  readerHbTitle: document.getElementById('reader-hb-title'),
  readerHbSubtitle: document.getElementById('reader-hb-subtitle'),
  readerAmbientSelect: document.getElementById('reader-ambient-select'),
  btnReaderTheme: document.getElementById('btn-reader-theme'),
  bookBase: document.getElementById('book-base'),
  flipbookContainer: document.getElementById('flipbook-container'),
  btnPrevPage: document.getElementById('btn-prev-page'),
  btnNextPage: document.getElementById('btn-next-page'),
  pageIndicator: document.getElementById('page-indicator'),
  btnToggleToc: document.getElementById('btn-toggle-toc'),
  btnToggleSound: document.getElementById('btn-toggle-sound'),
  readerAudioGroup: document.getElementById('reader-audio-group'),
  btnToggleBgm: document.getElementById('btn-toggle-bgm'),
  bgmVolumeSlider: document.getElementById('bgm-volume-slider'),
  btnToggleFullscreen: document.getElementById('btn-toggle-fullscreen'),
  thumbnailDrawer: document.getElementById('thumbnail-drawer'),
  btnCloseDrawer: document.getElementById('btn-close-drawer'),
  drawerThumbnailsTrack: document.getElementById('drawer-thumbnails-track'),
  passwordModal: document.getElementById('password-modal'),
  pwdHbTitle: document.getElementById('pwd-hb-title'),
  pwdForm: document.getElementById('pwd-form'),
  inputReaderPwd: document.getElementById('input-reader-pwd'),
  pwdErrorMsg: document.getElementById('pwd-error-msg'),
  errorScreen: document.getElementById('error-screen'),
  errorTitle: document.getElementById('error-title'),
  errorDesc: document.getElementById('error-desc'),
  toast: document.getElementById('reader-toast')
};

// ============================================================================
// THEME SYNC
// ============================================================================
function syncReaderTheme(theme) {
  document.documentElement.dataset.theme = theme;
  if (!DOM.btnReaderTheme) return;

  if (theme === 'light') {
    DOM.btnReaderTheme.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
      </svg>
    `;
    DOM.btnReaderTheme.title = 'Beralih ke Mode Gelap';
  } else {
    DOM.btnReaderTheme.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
    DOM.btnReaderTheme.title = 'Beralih ke Mode Terang';
  }
}

// ============================================================================
// INITIALIZATION
// ============================================================================
async function initReader() {
  // Extract handbook identifier from URL
  const urlParams = new URLSearchParams(window.location.search);
  const id = urlParams.get('id') || 'default';
  readerState.slugOrId = id;

  const savedTheme = localStorage.getItem('hfb_theme') || 'dark';
  syncReaderTheme(savedTheme);

  setupFirstTouchAutoplay();
  setupEventListeners();

  await loadAndDisplayHandbook();
}

async function loadAndDisplayHandbook(password = null) {
  const result = await fetchPublicHandbook(readerState.slugOrId, password);

  if (result.status === 'error') {
    showError(
      result.errorType === 'disabled' ? 'Handbook Dinonaktifkan' : 'Handbook Tidak Ditemukan',
      result.message || 'Link buku ini tidak berlaku atau telah dinonaktifkan oleh pemiliknya.'
    );
    return;
  }

  if (result.status === 'password_required') {
    DOM.pwdHbTitle.textContent = result.title || 'Handbook Terproteksi';
    DOM.passwordModal.style.display = 'flex';
    return;
  }

  // Success
  DOM.passwordModal.style.display = 'none';
  readerState.handbook = result.handbook;
  renderBook();
}

function renderBook() {
  const hb = readerState.handbook;
  document.title = `${hb.title} — Handbook Flipbook`;

  DOM.readerHbTitle.textContent = hb.title || 'Handbook Digital';
  DOM.readerHbSubtitle.textContent = hb.subtitle || '';

  // Setup BGM if provided by admin
  if (hb.audioUrl) {
    DOM.readerAudioGroup.style.display = 'flex';
    readerState.audioElement.src = hb.audioUrl;
    readerState.audioElement.loop = true;
    const initialVol = typeof hb.initialVolume === 'number' ? hb.initialVolume : 0.45;
    readerState.audioElement.volume = initialVol;
    DOM.bgmVolumeSlider.value = initialVol;

    // Autoplay policy: will trigger on first interaction if autoplay enabled
  } else {
    DOM.readerAudioGroup.style.display = 'none';
  }

  // Setup Flipbook Manager
  readerState.flipbookManager = new FlipbookManager(
    DOM.flipbookContainer,
    DOM.bookBase,
    {
      orientation: hb.orientation || 'portrait',
      coverColor: hb.coverColor || '#1e293b',
      onPageChange: handlePageChange,
      onInit: () => updatePageIndicator(0)
    }
  );

  readerState.flipbookManager.loadBook(hb.pages || [], hb.orientation, 0);
  renderThumbnailsDrawer();
}

function handlePageChange({ pageIndex, totalPages, isCover, isBackCover }) {
  updatePageIndicator(pageIndex);
  highlightActiveThumbnail(pageIndex);

  // Confetti on finishing the book
  if (isBackCover && totalPages > 1) {
    confetti({ particleCount: 70, spread: 80, origin: { y: 0.6 } });
  }
}

function updatePageIndicator(pageIndex) {
  const total = (readerState.handbook?.pages || []).length;
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

function renderThumbnailsDrawer() {
  DOM.drawerThumbnailsTrack.innerHTML = '';
  const pages = readerState.handbook?.pages || [];

  pages.forEach((page, index) => {
    const thumbItem = document.createElement('div');
    thumbItem.className = `thumb-item ${index === 0 ? 'active' : ''}`;
    thumbItem.dataset.page = index;

    thumbItem.innerHTML = `
      <div class="thumb-img-wrap">
        <img src="${page.dataUrl}" alt="${page.title}" class="thumb-img" loading="lazy" />
      </div>
      <span class="thumb-label">${index === 0 ? 'Sampul' : `Hal ${index + 1}`}</span>
    `;

    thumbItem.addEventListener('click', () => {
      readerState.flipbookManager.goToPage(index);
      DOM.thumbnailDrawer.classList.remove('open');
    });

    DOM.drawerThumbnailsTrack.appendChild(thumbItem);
  });
}

function highlightActiveThumbnail(pageIndex) {
  DOM.drawerThumbnailsTrack.querySelectorAll('.thumb-item').forEach((item) => {
    item.classList.toggle('active', parseInt(item.dataset.page, 10) === pageIndex);
  });
}

// ============================================================================
// AUDIO AUTOPLAY ON FIRST TOUCH
// ============================================================================
function setupFirstTouchAutoplay() {
  const triggerAudioOnFirstInteraction = () => {
    if (readerState.hasTouchedFirstTime) return;
    readerState.hasTouchedFirstTime = true;

    if (readerState.handbook?.audioUrl && readerState.handbook.autoplay !== false) {
      readerState.audioElement.play().then(() => {
        readerState.audioPlaying = true;
        DOM.btnToggleBgm.classList.add('active');
      }).catch(() => {});
    }

    window.removeEventListener('click', triggerAudioOnFirstInteraction);
    window.removeEventListener('keydown', triggerAudioOnFirstInteraction);
    window.removeEventListener('touchstart', triggerAudioOnFirstInteraction);
  };

  window.addEventListener('click', triggerAudioOnFirstInteraction, { passive: true });
  window.addEventListener('keydown', triggerAudioOnFirstInteraction, { passive: true });
  window.addEventListener('touchstart', triggerAudioOnFirstInteraction, { passive: true });
}

function showError(title, message) {
  DOM.errorTitle.textContent = title;
  DOM.errorDesc.textContent = message;
  DOM.errorScreen.style.display = 'flex';
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================
function setupEventListeners() {
  // Navigation
  DOM.btnPrevPage.addEventListener('click', () => readerState.flipbookManager?.prev());
  DOM.btnNextPage.addEventListener('click', () => readerState.flipbookManager?.next());

  // TOC Drawer
  DOM.btnToggleToc.addEventListener('click', () => DOM.thumbnailDrawer.classList.toggle('open'));
  DOM.btnCloseDrawer.addEventListener('click', () => DOM.thumbnailDrawer.classList.remove('open'));

  // Sound Effect
  DOM.btnToggleSound.addEventListener('click', () => {
    readerState.soundEnabled = !readerState.soundEnabled;
    readerState.flipbookManager?.setSoundEnabled(readerState.soundEnabled);
    DOM.btnToggleSound.classList.toggle('active', readerState.soundEnabled);
  });

  // BGM Toggle & Volume
  DOM.btnToggleBgm.addEventListener('click', () => {
    if (readerState.audioPlaying) {
      readerState.audioElement.pause();
      readerState.audioPlaying = false;
      DOM.btnToggleBgm.classList.remove('active');
    } else {
      readerState.audioElement.play().then(() => {
        readerState.audioPlaying = true;
        DOM.btnToggleBgm.classList.add('active');
      }).catch(() => {});
    }
  });

  DOM.bgmVolumeSlider.addEventListener('input', (e) => {
    readerState.audioElement.volume = parseFloat(e.target.value);
  });

  // Fullscreen
  DOM.btnToggleFullscreen.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  });

  // Ambient Environment
  DOM.readerAmbientSelect.addEventListener('change', (e) => {
    document.body.dataset.ambient = e.target.value;
  });

  // Theme Toggle
  DOM.btnReaderTheme.addEventListener('click', () => {
    const current = document.documentElement.dataset.theme;
    const next = current === 'dark' ? 'light' : 'dark';
    localStorage.setItem('hfb_theme', next);
    syncReaderTheme(next);
  });

  // Password submission
  DOM.pwdForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    DOM.pwdErrorMsg.style.display = 'none';
    const pwd = DOM.inputReaderPwd.value;

    const res = await fetchPublicHandbook(readerState.slugOrId, pwd);
    if (res.status === 'success') {
      DOM.passwordModal.style.display = 'none';
      readerState.handbook = res.handbook;
      renderBook();
    } else {
      DOM.pwdErrorMsg.textContent = 'Kata sandi salah. Silakan coba lagi.';
      DOM.pwdErrorMsg.style.display = 'block';
    }
  });

  // Keyboard Navigation
  window.addEventListener('keydown', (e) => {
    if (DOM.passwordModal.style.display === 'flex') return;

    if (e.key === 'ArrowRight' || e.key === ' ') {
      e.preventDefault();
      readerState.flipbookManager?.next();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      readerState.flipbookManager?.prev();
    } else if (e.key === 'f' || e.key === 'F') {
      DOM.btnToggleFullscreen.click();
    } else if (e.key === 'm' || e.key === 'M') {
      DOM.btnToggleBgm.click();
    } else if (e.key === 'Escape') {
      DOM.thumbnailDrawer.classList.remove('open');
    }
  });
}

initReader().catch(console.error);
