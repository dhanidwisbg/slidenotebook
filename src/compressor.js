// Browser-side Image Compression & Natural Sorting
// Implements FR-1 (natural sort), FR-2 (max 1800px compression), FR-3/FR-4 (orientation detection)

/**
 * Natural sort comparator for filenames (e.g. slide2.png comes before slide10.png)
 */
export function naturalSort(a, b) {
  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * Reads an image file and compresses it to max 1800px width/height while maintaining aspect ratio
 */
export async function processImageFile(file, maxWidth = 1800, quality = 0.88) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        const originalWidth = width;
        const originalHeight = height;

        // Determine orientation
        const isLandscape = width > height;
        const orientation = isLandscape ? 'landscape' : 'portrait';
        const aspectRatio = width / height;

        // Downscale if wider or taller than maxWidth
        if (width > maxWidth || height > maxWidth) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxWidth) / height);
            height = maxWidth;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        // High quality smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to dataUrl (JPEG for optimal file size and fast decoding)
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);

        resolve({
          id: 'page_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now(),
          title: cleanFilenameToTitle(file.name),
          originalName: file.name,
          width,
          height,
          originalWidth,
          originalHeight,
          orientation,
          aspectRatio,
          dataUrl: compressedDataUrl,
          fileSize: Math.round(compressedDataUrl.length * 0.75) // approximate bytes
        });
      };

      img.onerror = () => reject(new Error(`Gagal membaca file gambar: ${file.name}`));
      img.src = e.target.result;
    };

    reader.onerror = () => reject(new Error(`Gagal membaca file: ${file.name}`));
    reader.readAsDataURL(file);
  });
}

/**
 * Converts filename like "slide_02_pengenalan.png" to readable title "Pengenalan" or "Slide 02 Pengenalan"
 */
export function cleanFilenameToTitle(filename) {
  const withoutExt = filename.replace(/\.[^/.]+$/, '');
  const clean = withoutExt.replace(/[_-]+/g, ' ').trim();
  // Capitalize words
  return clean.replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Checks whether page orientation matches handbook target orientation
 */
export function checkOrientationMismatch(page, targetOrientation) {
  if (!page || !targetOrientation) return false;
  return page.orientation !== targetOrientation;
}
