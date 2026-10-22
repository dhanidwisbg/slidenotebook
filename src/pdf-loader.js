// PDF Loader (FR-15)
// Converts uploaded PDF files into page images directly in the browser using PDF.js

import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

/**
 * Loads a PDF file and converts all its pages into high-res compressed images
 * @param {File} file 
 * @param {Function} onProgress (current, total)
 * @returns {Promise<Array>} array of page objects
 */
export async function convertPdfToPages(file, onProgress) {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;
  const pages = [];

  // Optimal resolution for high-DPI flipbooks without memory choking
  const maxDimension = 1600;

  for (let i = 1; i <= numPages; i++) {
    if (onProgress) onProgress(i, numPages);

    const pdfPage = await pdf.getPage(i);
    const unscaledViewport = pdfPage.getViewport({ scale: 1.0 });
    const maxNative = Math.max(unscaledViewport.width, unscaledViewport.height);

    // Direct 1-pass scaling: avoids rendering 4K canvas and downsampling
    const targetScale = maxNative > 0 ? Math.min(2.0, Math.max(0.75, maxDimension / maxNative)) : 1.5;
    const viewport = pdfPage.getViewport({ scale: targetScale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d', { willReadFrequently: false });

    await pdfPage.render({
      canvasContext: ctx,
      viewport: viewport
    }).promise;

    const targetWidth = canvas.width;
    const targetHeight = canvas.height;
    const isLandscape = targetWidth > targetHeight;

    // Quality 0.82 delivers crisp text while cutting base64 memory by ~50%
    const dataUrl = canvas.toDataURL('image/jpeg', 0.82);

    // Release canvas memory immediately to prevent browser memory spike
    canvas.width = 0;
    canvas.height = 0;

    pages.push({
      id: 'page_pdf_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now(),
      title: `Halaman ${i}`,
      originalName: `${file.name.replace(/\.pdf$/i, '')} - Hal ${i}`,
      width: targetWidth,
      height: targetHeight,
      originalWidth: Math.round(unscaledViewport.width),
      originalHeight: Math.round(unscaledViewport.height),
      orientation: isLandscape ? 'landscape' : 'portrait',
      aspectRatio: targetWidth / targetHeight,
      dataUrl: dataUrl,
      fileSize: Math.round(dataUrl.length * 0.75)
    });

    // Yield control to browser so UI doesn't freeze and progress updates smoothly
    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  return pages;
}
