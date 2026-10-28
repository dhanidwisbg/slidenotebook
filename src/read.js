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
  hasTouchedFirstTime: false,
  zoomLevel: 1.0,
  autoPlay: false,
  autoPlayTimer: null,
  _toastTimer: null
};

// DOM references
const DOM = {
  readerTopBar: document.getElementById('reader-top-bar'),
  readerHbTitle: document.getElementById('reader-hb-title'),
  readerHbSubtitle: document.getElementById('reader-hb-subtitle'),
  readerOrientBadge: document.getElementById('reader-orient-badge'),
  btnReaderShare: document.getElementById('btn-reader-share'),
  btnReaderShortcuts: document.getElementById('btn-reader-shortcuts'),
  shortcutsModal: document.getElementById('shortcuts-modal'),
  btnCloseShortcuts: document.getElementById('btn-close-shortcuts'),
  jumpModal: document.getElementById('jump-modal'),
  btnCloseJump: document.getElementById('btn-close-jump'),
  jumpForm: document.getElementById('jump-form'),
  inputJumpPage: document.getElementById('input-jump-page'),
  jumpHintText: document.getElementById('jump-hint-text'),
  readerProgressBar: document.getElementById('reader-progress-bar'),
  btnToggleAutoPlay: document.getElementById('btn-toggle-autoplay'),
  iconAutoPlayPlay: document.getElementById('icon-autoplay-play'),
  iconAutoPlayPause: document.getElementById('icon-autoplay-pause'),
  btnZoomOut: document.getElementById('btn-zoom-out'),
  btnZoomIn: document.getElementById('btn-zoom-in'),
  zoomLevelBadge: document.getElementById('zoom-level-badge'),
  readerAmbientSelect: null, // removed ambient feature
  btnReaderTheme: document.getElementById('btn-reader-theme'),
  bookStage: document.getElementById('book-stage'),
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
  const directKey = urlParams.get('key') || null;
  readerState.slugOrId = id;
  readerState.directKey = directKey; // store for later use

  const savedTheme = localStorage.getItem('hfb_theme') || 'dark';
  syncReaderTheme(savedTheme);

  setupEventListeners();

  await loadAndDisplayHandbook(null, directKey);
}

async function loadAndDisplayHandbook(password = null, directKey = null) {
  const result = await fetchPublicHandbook(readerState.slugOrId, password, directKey || readerState.directKey);

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

  if (DOM.readerOrientBadge) {
    DOM.readerOrientBadge.style.display = 'inline-block';
    DOM.readerOrientBadge.textContent = hb.orientation === 'landscape' ? 'Lanskap 16:9' : 'Buku Tegak';
  }

  // Setup BGM if provided by admin
  if (hb.audioUrl) {
    DOM.readerAudioGroup.style.display = 'flex';
    readerState.audioElement.src = hb.audioUrl;
    readerState.audioElement.loop = true;
    const initialVol = typeof hb.initialVolume === 'number' ? hb.initialVolume : 0.45;
    readerState.audioElement.volume = initialVol;
    DOM.bgmVolumeSlider.value = initialVol;

    // Trigger autoplay if enabled
    if (hb.autoplay !== false) {
      startBgmPlayback();
    }
  } else {
    DOM.readerAudioGroup.style.display = 'none';
  }

  // Reset zoom & progress
  setZoom(1.0);
  if (DOM.readerProgressBar) {
    DOM.readerProgressBar.style.width = '0%';
  }

  // Setup Flipbook Manager
  readerState.flipbookManager = new FlipbookManager(
    DOM.flipbookContainer,
    DOM.bookBase,
    {
      orientation: hb.orientation || 'portrait',
      coverColor: hb.coverColor || '#1e293b',
      onPageChange: handlePageChange,
      onInit: () => {
        updatePageIndicator(0);
        if (DOM.readerProgressBar) DOM.readerProgressBar.style.width = '0%';
      }
    }
  );

  readerState.flipbookManager.loadBook(hb.pages || [], hb.orientation, 0);
  renderThumbnailsDrawer();
}

function handlePageChange({ pageIndex, totalPages, isCover, isBackCover }) {
  updatePageIndicator(pageIndex);
  highlightActiveThumbnail(pageIndex);

  // Update Reading Progress Bar
  if (DOM.readerProgressBar) {
    const progress = totalPages > 1 ? (pageIndex / (totalPages - 1)) * 100 : 100;
    const rounded = Math.round(Math.min(100, Math.max(0, progress)));
    DOM.readerProgressBar.style.width = `${rounded}%`;
    DOM.readerProgressBar.parentElement?.setAttribute('aria-valuenow', rounded.toString());
  }

  // If auto-play active, reset timer to give full 5s on new page
  if (readerState.autoPlay) {
    startAutoPlay();
  }

  // Turn-page is an explicit user gesture - start BGM if waiting for interaction!
  if (!readerState.audioPlaying && readerState.handbook?.audioUrl && readerState.handbook.autoplay !== false) {
    startBgmPlayback();
  }

  // Confetti on finishing the book (cek prefers-reduced-motion)
  if (isBackCover && totalPages > 1) {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!prefersReduced) {
      confetti({ particleCount: 70, spread: 80, origin: { y: 0.6 } });
    }
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
        <img src="${page.imageUrl || page.dataUrl}" alt="${page.title}" class="thumb-img" loading="lazy" />
      </div>
      <span class="thumb-label">${index === 0 ? 'Sampul' : `Hal ${index + 1}`}</span>
    `;

    thumbItem.addEventListener('click', () => {
      readerState.flipbookManager.goToPage(index);
      DOM.thumbnailDrawer.classList.remove('open');
      if (!readerState.audioPlaying && readerState.handbook?.audioUrl && readerState.handbook.autoplay !== false) {
        startBgmPlayback();
      }
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
// AUDIO AUTOPLAY & INTERACTION UNLOCK
// ============================================================================
function startBgmPlayback() {
  if (!readerState.handbook?.audioUrl || readerState.audioPlaying) return;

  readerState.audioElement.play().then(() => {
    readerState.audioPlaying = true;
    DOM.btnToggleBgm?.classList.add('active');
  }).catch((err) => {
    console.log('[Reader BGM] Autoplay deferred until user gesture:', err.message);
    setupFirstTouchAutoplay();
  });
}

function setupFirstTouchAutoplay() {
  const triggerAudioOnFirstInteraction = () => {
    if (readerState.audioPlaying || !readerState.handbook?.audioUrl) {
      cleanListeners();
      return;
    }

    if (readerState.handbook.autoplay !== false) {
      readerState.audioElement.play().then(() => {
        readerState.audioPlaying = true;
        DOM.btnToggleBgm?.classList.add('active');
        cleanListeners();
      }).catch(() => {});
    }
  };

  const cleanListeners = () => {
    window.removeEventListener('click', triggerAudioOnFirstInteraction);
    window.removeEventListener('keydown', triggerAudioOnFirstInteraction);
    window.removeEventListener('touchstart', triggerAudioOnFirstInteraction);
    window.removeEventListener('pointerdown', triggerAudioOnFirstInteraction);
  };

  window.addEventListener('click', triggerAudioOnFirstInteraction, { passive: true });
  window.addEventListener('keydown', triggerAudioOnFirstInteraction, { passive: true });
  window.addEventListener('touchstart', triggerAudioOnFirstInteraction, { passive: true });
  window.addEventListener('pointerdown', triggerAudioOnFirstInteraction, { passive: true });
}

function showError(title, message) {
  DOM.errorTitle.textContent = title;
  DOM.errorDesc.textContent = message;
  DOM.errorScreen.style.display = 'flex';
}

function showToast(message, duration = 2800) {
  if (!DOM.toast) return;
  DOM.toast.textContent = message;
  DOM.toast.classList.add('show');
  clearTimeout(readerState._toastTimer);
  readerState._toastTimer = setTimeout(() => {
    DOM.toast.classList.remove('show');
  }, duration);
}

function setZoom(level) {
  readerState.zoomLevel = Math.max(0.7, Math.min(1.7, parseFloat(level.toFixed(2))));
  const percent = Math.round(readerState.zoomLevel * 100);
  if (DOM.zoomLevelBadge) {
    DOM.zoomLevelBadge.textContent = `${percent}%`;
  }
  if (DOM.bookStage) {
    DOM.bookStage.style.transform = `scale(${readerState.zoomLevel})`;
    DOM.bookStage.style.transformOrigin = 'center center';
    DOM.bookStage.style.transition = 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)';
  }
}

function toggleAutoPlay() {
  readerState.autoPlay = !readerState.autoPlay;
  if (readerState.autoPlay) {
    DOM.btnToggleAutoPlay?.classList.add('active');
    if (DOM.iconAutoPlayPlay) DOM.iconAutoPlayPlay.style.display = 'none';
    if (DOM.iconAutoPlayPause) DOM.iconAutoPlayPause.style.display = 'block';
    showToast('Auto-Play aktif: Halaman berpindah tiap 5 detik ⏱️');
    startAutoPlay();
  } else {
    stopAutoPlay();
    DOM.btnToggleAutoPlay?.classList.remove('active');
    if (DOM.iconAutoPlayPlay) DOM.iconAutoPlayPlay.style.display = 'block';
    if (DOM.iconAutoPlayPause) DOM.iconAutoPlayPause.style.display = 'none';
    showToast('Auto-Play dinonaktifkan ⏸️');
  }
}

function startAutoPlay() {
  stopAutoPlay();
  readerState.autoPlayTimer = setInterval(() => {
    if (!readerState.flipbookManager) return;
    const current = readerState.flipbookManager.currentPage;
    const total = readerState.flipbookManager.totalPages;
    if (current >= total - 1) {
      readerState.flipbookManager.goToPage(0);
    } else {
      readerState.flipbookManager.next();
    }
  }, 5000);
}

function stopAutoPlay() {
  if (readerState.autoPlayTimer) {
    clearInterval(readerState.autoPlayTimer);
    readerState.autoPlayTimer = null;
  }
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================
function setupEventListeners() {
  // Navigation
  DOM.btnPrevPage.addEventListener('click', () => {
    readerState.flipbookManager?.prev();
    if (!readerState.audioPlaying && readerState.handbook?.audioUrl && readerState.handbook.autoplay !== false) {
      startBgmPlayback();
    }
  });
  DOM.btnNextPage.addEventListener('click', () => {
    readerState.flipbookManager?.next();
    if (!readerState.audioPlaying && readerState.handbook?.audioUrl && readerState.handbook.autoplay !== false) {
      startBgmPlayback();
    }
  });

  // TOC Drawer
  DOM.btnToggleToc.addEventListener('click', () => DOM.thumbnailDrawer.classList.toggle('open'));
  DOM.btnCloseDrawer.addEventListener('click', () => DOM.thumbnailDrawer.classList.remove('open'));

  // Sound Effect (Page flip paper)
  DOM.btnToggleSound.addEventListener('click', () => {
    readerState.soundEnabled = !readerState.soundEnabled;
    readerState.flipbookManager?.setSoundEnabled(readerState.soundEnabled);
    DOM.btnToggleSound.classList.toggle('active', readerState.soundEnabled);
    showToast(readerState.soundEnabled ? 'Suara efek kertas aktif 🔊' : 'Suara efek kertas dimatikan 🔇');
  });

  // Auto-Play Slide with hover pause
  DOM.btnToggleAutoPlay?.addEventListener('click', () => {
    toggleAutoPlay();
  });

  // Hentikan autoplay sementara saat pengguna mengarahkan mouse ke stage buku
  DOM.bookStage?.addEventListener('mouseenter', () => {
    if (readerState.autoPlay) {
      stopAutoPlay();
    }
  });

  DOM.bookStage?.addEventListener('mouseleave', () => {
    if (readerState.autoPlay) {
      startAutoPlay();
    }
  });

  // Zoom Controls
  DOM.btnZoomIn?.addEventListener('click', () => {
    setZoom(readerState.zoomLevel + 0.15);
  });
  DOM.btnZoomOut?.addEventListener('click', () => {
    setZoom(readerState.zoomLevel - 0.15);
  });
  DOM.zoomLevelBadge?.addEventListener('click', () => {
    setZoom(1.0);
    showToast('Zoom diatur ulang ke 100%');
  });

  // Focus Trapping and Restoration for Modals
  let previousActiveElement = null;

  function openModal(modalEl, initialFocusEl) {
    if (!modalEl) return;
    previousActiveElement = document.activeElement;
    modalEl.style.display = 'flex';
    modalEl.setAttribute('aria-hidden', 'false');
    const focusTarget = initialFocusEl || modalEl.querySelector('input, button, select');
    setTimeout(() => focusTarget?.focus(), 50);
  }

  function closeModal(modalEl) {
    if (!modalEl) return;
    modalEl.style.display = 'none';
    modalEl.setAttribute('aria-hidden', 'true');
    if (previousActiveElement && typeof previousActiveElement.focus === 'function') {
      previousActiveElement.focus();
    }
  }

  // Jump to Page
  DOM.pageIndicator?.addEventListener('click', () => {
    const total = (readerState.handbook?.pages || []).length;
    if (total <= 1) return;
    if (DOM.jumpHintText) DOM.jumpHintText.textContent = `Tersedia 1 sampai ${total} halaman`;
    if (DOM.inputJumpPage) {
      DOM.inputJumpPage.max = total;
      DOM.inputJumpPage.value = Math.max(1, (readerState.flipbookManager?.currentPage || 0) + 1);
    }
    openModal(DOM.jumpModal, DOM.inputJumpPage);
  });

  DOM.jumpForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const targetPage = parseInt(DOM.inputJumpPage.value, 10);
    const total = (readerState.handbook?.pages || []).length;
    if (targetPage >= 1 && targetPage <= total) {
      readerState.flipbookManager?.goToPage(targetPage - 1);
      closeModal(DOM.jumpModal);
      showToast(`Menuju halaman ${targetPage}`);
    }
  });

  DOM.btnCloseJump?.addEventListener('click', () => {
    closeModal(DOM.jumpModal);
  });

  // Shortcuts Modal
  DOM.btnReaderShortcuts?.addEventListener('click', () => {
    openModal(DOM.shortcutsModal, DOM.btnCloseShortcuts);
  });
  DOM.btnCloseShortcuts?.addEventListener('click', () => {
    closeModal(DOM.shortcutsModal);
  });

  // Close modals on clicking overlay background
  [DOM.shortcutsModal, DOM.jumpModal].forEach((modal) => {
    modal?.addEventListener('click', (e) => {
      if (e.target === modal) closeModal(modal);
    });
  });

  // BGM Audio Element events
  readerState.audioElement.addEventListener('play', () => {
    readerState.audioPlaying = true;
    DOM.btnToggleBgm?.classList.add('active');
  });

  readerState.audioElement.addEventListener('pause', () => {
    readerState.audioPlaying = false;
    DOM.btnToggleBgm?.classList.remove('active');
  });

  readerState.audioElement.addEventListener('ended', () => {
    readerState.audioPlaying = false;
    DOM.btnToggleBgm?.classList.remove('active');
  });

  readerState.audioElement.addEventListener('error', (e) => {
    console.error('[Reader BGM] Audio element error:', e);
    readerState.audioPlaying = false;
    DOM.btnToggleBgm?.classList.remove('active');
  });

  // BGM Toggle Button
  DOM.btnToggleBgm.addEventListener('click', () => {
    if (readerState.audioPlaying) {
      readerState.audioElement.pause();
    } else {
      readerState.audioElement.play().catch((err) => {
        console.warn('[Reader BGM] Manual play error:', err);
      });
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

  // Ambient Environment - feature removed

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

  // Keyboard Navigation with Accessibility & Form Guards
  window.addEventListener('keydown', (e) => {
    // 1. Abaikan shortcut jika fokus sedang berada pada form controls (input, textarea, select)
    const activeEl = document.activeElement;
    const isEditing = activeEl && (
      activeEl.tagName === 'INPUT' ||
      activeEl.tagName === 'TEXTAREA' ||
      activeEl.tagName === 'SELECT' ||
      activeEl.isContentEditable
    );

    // Escape harus selalu bisa menutup modal/drawer kapan saja
    if (e.key === 'Escape') {
      DOM.thumbnailDrawer?.classList.remove('open');
      if (DOM.shortcutsModal) DOM.shortcutsModal.style.display = 'none';
      if (DOM.jumpModal) DOM.jumpModal.style.display = 'none';
      return;
    }

    if (isEditing) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    if (DOM.passwordModal && DOM.passwordModal.style.display === 'flex') return;
    if (DOM.jumpModal && DOM.jumpModal.style.display === 'flex') return;
    if (DOM.shortcutsModal && DOM.shortcutsModal.style.display === 'flex') return;

    // Jangan cegah spasi jika elemen yang fokus adalah tombol interaktif biasa
    if (e.key === ' ' && activeEl && activeEl.tagName === 'BUTTON') {
      return;
    }

    if (e.key === 'ArrowRight' || e.key === ' ') {
      e.preventDefault();
      readerState.flipbookManager?.next();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      readerState.flipbookManager?.prev();
    } else if (e.key === 'f' || e.key === 'F') {
      DOM.btnToggleFullscreen?.click();
    } else if (e.key === 'm' || e.key === 'M') {
      DOM.btnToggleBgm?.click();
    } else if (e.key === 's' || e.key === 'S') {
      DOM.btnToggleSound?.click();
    } else if (e.key === 'p' || e.key === 'P') {
      toggleAutoPlay();
    } else if (e.key === 't' || e.key === 'T') {
      DOM.thumbnailDrawer?.classList.toggle('open');
    } else if (e.key === '+' || e.key === '=') {
      setZoom(readerState.zoomLevel + 0.15);
    } else if (e.key === '-' || e.key === '_') {
      setZoom(readerState.zoomLevel - 0.15);
    } else if (e.key === '0' || e.key === 'z' || e.key === 'Z') {
      setZoom(1.0);
    } else if (e.key === '?') {
      if (DOM.shortcutsModal) {
        DOM.shortcutsModal.style.display = DOM.shortcutsModal.style.display === 'flex' ? 'none' : 'flex';
      }
    }
  });
}

initReader().catch(console.error);
