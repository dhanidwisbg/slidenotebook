// Flipbook Manager (FR-5, FR-6, FR-7, FR-17)
// Integrates StPageFlip with realistic 3D book cover base, responsive spreads, and audio

import { PageFlip } from 'page-flip';
import { playPageFlipSound } from './sound.js';

export class FlipbookManager {
  constructor(containerElement, baseElement, options = {}) {
    this.container = containerElement;
    this.baseElement = baseElement;
    this.options = options;
    this.pageFlip = null;
    this.pages = [];
    this.orientation = options.orientation || 'portrait';
    this.coverColor = options.coverColor || '#1e293b';
    this.soundEnabled = true;
    this.currentPage = 0;
    this.totalPages = 0;
    this.onPageChange = options.onPageChange || null;
    this.onInit = options.onInit || null;

    this.resizeObserver = new ResizeObserver(() => {
      this.handleContainerResize();
    });
    this.resizeObserver.observe(this.container.parentElement || document.body);
  }

  setSoundEnabled(enabled) {
    this.soundEnabled = enabled;
  }

  setCoverColor(color) {
    this.coverColor = color;
    if (this.baseElement) {
      this.baseElement.style.setProperty('--book-cover-color', color);
    }
  }

  destroy() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    if (this.pageFlip) {
      try {
        this.pageFlip.destroy();
      } catch (e) {
        // ignore cleanup error
      }
      this.pageFlip = null;
    }
    this.container.innerHTML = '';
  }

  /**
   * Initializes the flipbook with page objects
   */
  async loadBook(pages, targetOrientation = 'portrait', startPageIndex = 0) {
    this.destroy();
    this.pages = pages || [];
    this.orientation = targetOrientation;
    this.totalPages = this.pages.length;

    if (this.totalPages === 0) return;

    // Clear and create container structure
    this.container.innerHTML = '';

    // Calculate dimensions based on viewport & orientation
    const dims = this.calculateBookDimensions();

    const isMobile = window.innerWidth < 768;
    // Both Portrait and Landscape now render as a two-page spread on desktop/laptop!
    const usePortrait = isMobile;

    // Create wrapper element for PageFlip
    const flipWrapper = document.createElement('div');
    flipWrapper.className = 'st-flipbook-root';
    this.container.appendChild(flipWrapper);

    // Build page HTML elements
    this.pages.forEach((page, index) => {
      const pageEl = document.createElement('div');
      pageEl.className = 'book-page';
      pageEl.dataset.pageNumber = index;

      const isCover = index === 0;
      const isBack = index === this.totalPages - 1;

      if (isCover) {
        pageEl.classList.add('--hardcover', '--cover-front');
      } else if (isBack) {
        pageEl.classList.add('--hardcover', '--cover-back');
      } else {
        pageEl.classList.add('--inner-page');
      }

      // Image container with letterboxing support for mismatched ratios (FR-4)
      pageEl.innerHTML = `
        <div class="page-content-wrapper">
          <img src="${page.imageUrl || page.dataUrl}" alt="${page.title || `Halaman ${index + 1}`}" loading="lazy" class="page-image" />
          <div class="page-spine-shadow"></div>
          <div class="page-edge-highlight"></div>
        </div>
      `;

      flipWrapper.appendChild(pageEl);
    });

    // Initialize PageFlip instance with fixed dimensions for precise sizing
    this.pageFlip = new PageFlip(flipWrapper, {
      width: dims.pageWidth,
      height: dims.pageHeight,
      size: 'fixed',
      minWidth: dims.pageWidth,
      maxWidth: dims.pageWidth,
      minHeight: dims.pageHeight,
      maxHeight: dims.pageHeight,
      maxShadowOpacity: 0.65,
      showCover: true,
      mobileScrollSupport: true,
      drawShadow: true,
      flippingTime: 750,
      usePortrait: usePortrait,
      startPage: Math.min(startPageIndex, this.totalPages - 1),
      useMouseEvents: true,
      swipeDistance: 30,
      showPageCorners: true,
      disableFlipByClick: false
    });

    this.pageFlip.loadFromHTML(flipWrapper.querySelectorAll('.book-page'));

    // Listen to flip events
    this.pageFlip.on('flip', (e) => {
      this.currentPage = e.data;
      if (this.soundEnabled) {
        playPageFlipSound();
      }
      this.updateBookBasePosition();
      if (this.onPageChange) {
        this.onPageChange({
          pageIndex: this.currentPage,
          totalPages: this.totalPages,
          isCover: this.currentPage === 0,
          isBackCover: this.currentPage === this.totalPages - 1
        });
      }
    });

    this.pageFlip.on('init', () => {
      this.updateBookBasePosition();
      this._applyScaleToFillViewport(dims);
      this._setupCoverCentering(dims);
      // Animasi masuk: buku muncul dengan scale-up + fade saat pertama load
      const stage = this.baseElement?.parentElement;
      if (stage) {
        stage.classList.add('animate-enter');
        setTimeout(() => stage.classList.remove('animate-enter'), 1000);
      }
      if (this.onInit) {
        this.onInit({
          totalPages: this.totalPages
        });
      }
    });

    // Update book base immediately
    this.updateBookBasePosition();
  }

  /**
   * Apply CSS scale transform to the flipbook root to fill available vertical space.
   * For landscape books, the height is often limited by width constraints, leaving
   * unused vertical space. Scale up to fill it proportionally.
   */
  _applyScaleToFillViewport(dims) {
    // Calculate available area (same as calculateBookDimensions)
    const availHeight = Math.max(450, window.innerHeight - 85);
    const currentHeight = dims.pageHeight;

    // Scale factor: how much can we grow vertically?
    const verticalScale = availHeight / currentHeight;

    // For landscape, scale up if there's more than 15% vertical space unused
    // For portrait, don't scale (it usually fills height well already)
    if (this.orientation === 'landscape' && verticalScale > 1.15) {
      // Cap scale at verticalScale to avoid horizontal overflow
      const availWidth = Math.max(340, window.innerWidth - 8);
      const currentSpreadWidth = dims.pageWidth * 2;
      const horizontalScale = availWidth / currentSpreadWidth;
      const finalScale = Math.min(verticalScale, horizontalScale, 1.8); // max 1.8x scale

      if (finalScale > 1.05) {
        const flipEl = this.container.querySelector('.st-flipbook-root');
        if (flipEl) {
          flipEl.style.transform = `scale(${finalScale.toFixed(3)})`;
          flipEl.style.transformOrigin = 'center center';
        }
      }
    }
  }

  /**
   * Animasi masuk buku: sampul muncul di tengah (scale-up + fade),
   * lalu saat halaman pertama dibuka, buku bergeser kanan agar
   * spread 2 halaman tepat di tengah viewport.
   */
  _setupCoverCentering(dims) {
    const stage = this.baseElement?.parentElement;
    if (!stage) return;

    // CSS var: geser 1/4 lebar canvas (TERMASUK scale) agar halaman kiri/kanan pas di tengah viewport
    const canvas = this.container.querySelector('.st-flipbook-root');
    const canvasW = canvas ? canvas.getBoundingClientRect().width : dims.pageWidth * 2;
    stage.style.setProperty('--page-shift', `${Math.round(canvasW / 4)}px`);

    const isMobile = window.innerWidth < 768;
    if (isMobile) return; // HP: single page selalu center, skip animasi geser

    const updateCentering = () => {
      stage.classList.toggle('cover-centered', this.currentPage === 0);
      stage.classList.toggle('back-centered', this.currentPage >= this.totalPages - 1);
    };

    this.pageFlip.on('flip', updateCentering);
    updateCentering();
  }

  /**
   * Calculates optimal page width and height to fit screen gracefully and legibly.
   * Both portrait and landscape use two-page spread on desktop.
   * For landscape (16:9 slides), we prioritize maximizing HEIGHT so text is large and legible.
   */
  calculateBookDimensions() {
    // Utilize full screen viewport with minimal padding so text is large and easy to read
    // Use slightly less horizontal padding to allow bigger slides
    const availWidth = Math.max(340, window.innerWidth - 8);
    // book-stage: 8px top + 70px bottom = 78px. We use 85px for slight safety margin.
    const availHeight = Math.max(450, window.innerHeight - 85);

    let ratio; // width / height for a SINGLE page
    if (this.orientation === 'landscape') {
      ratio = 16 / 9; // Landscape slide ratio (~1.778)
    } else {
      ratio = 210 / 297; // A-series portrait ratio (~0.707)
    }

    const isMobile = window.innerWidth < 768;
    const isSinglePage = isMobile;

    let targetPageHeight, targetPageWidth;

    if (isSinglePage) {
      // Single page takes full available width on phone
      const maxWidth = availWidth * 0.98;
      const maxHeight = availHeight * 0.96;

      if (this.orientation === 'landscape') {
        // On mobile landscape, fit within height first (it's wide)
        targetPageHeight = Math.min(maxHeight, maxWidth / ratio);
        targetPageWidth = targetPageHeight * ratio;
        // Don't exceed available width
        if (targetPageWidth > maxWidth) {
          targetPageWidth = maxWidth;
          targetPageHeight = targetPageWidth / ratio;
        }
      } else {
        targetPageHeight = Math.min(maxHeight, maxWidth / ratio);
        targetPageWidth = targetPageHeight * ratio;
      }
    } else {
      // Two page spread on desktop (left page and right page side-by-side)
      // Use 98% of available width for maximum size
      const maxSpreadWidth = availWidth * 0.98;
      const maxHeight = availHeight * 0.97;

      // Strategy: Fit within height first, then check width
      const widthFromHeight = maxHeight * ratio;
      if (widthFromHeight * 2 <= maxSpreadWidth) {
        // Height-limited: both pages fit within available width when height is maximized
        targetPageHeight = maxHeight;
        targetPageWidth = widthFromHeight;
      } else {
        // Width-limited: split available width between two pages
        targetPageWidth = maxSpreadWidth / 2;
        targetPageHeight = targetPageWidth / ratio;
      }
    }

    return {
      pageWidth: Math.round(targetPageWidth),
      pageHeight: Math.round(targetPageHeight),
      isSinglePage
    };
  }

  handleContainerResize() {
    if (!this.pageFlip || !this.pages.length) return;
    // Debounce resize to avoid thrashing, preserving currentPage and zoom
    clearTimeout(this._resizeTimer);
    this._resizeTimer = setTimeout(() => {
      const savedPage = this.currentPage;
      this.loadBook(this.pages, this.orientation, savedPage);
    }, 200);
  }

  /**
   * Updates the 3D book base (alas buku, FR-7):
   * When showing single page (front cover or back cover), base shrinks to 1 page!
   * When opened inside, base widens to 2-page spread!
   */
  updateBookBasePosition() {
    if (!this.baseElement || !this.pageFlip) return;

    try {
      const bounds = this.pageFlip.getBoundsRect();
      if (!bounds || bounds.width === 0) return;

      const isMobile = window.innerWidth < 768;
      const isCover = this.currentPage === 0;
      const isBackCover = this.currentPage >= this.totalPages - 1;

      // Base width and height tracking PageFlip canvas
      const padding = 16;
      const dims = this.calculateBookDimensions();
      // Cover tampil: base menyusut jadi 1 halaman (buku tertutup), expand saat dibuka
      const isSingleCover = !isMobile && (isCover || isBackCover);
      let baseWidth = (isSingleCover ? dims.pageWidth : bounds.width) + padding * 2;
      let baseHeight = bounds.height + padding * 2;

      // Both Portrait and Landscape now expand to 2-page spread inside!
      if (!isMobile) {
        if (isCover) {
          this.baseElement.dataset.state = 'cover-front';
        } else if (isBackCover) {
          this.baseElement.dataset.state = 'cover-back';
        } else {
          this.baseElement.dataset.state = 'spread';
        }
      } else {
        this.baseElement.dataset.state = 'single';
      }

      this.baseElement.style.width = `${Math.round(baseWidth)}px`;
      this.baseElement.style.height = `${Math.round(baseHeight)}px`;
    } catch (e) {
      // ignore
    }
  }

  next() {
    if (this.pageFlip) this.pageFlip.flipNext();
  }

  prev() {
    if (this.pageFlip) this.pageFlip.flipPrev();
  }

  goToPage(index) {
    if (this.pageFlip && index >= 0 && index < this.totalPages) {
      this.pageFlip.flip(index);
    }
  }
}
