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

  for (let i = 1; i <= numPages; i++) {
    if (onProgress) onProgress(i, numPages);

    const pdfPage = await pdf.getPage(i);
    const viewport = pdfPage.getViewport({ scale: 2.0 }); // 2x scale for sharp text

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');

    const renderContext = {
      canvasContext: ctx,
      viewport: viewport
    };

    await pdfPage.render(renderContext).promise;

    // Constrain to max 1800px width/height
    const maxWidth = 1800;
    let targetWidth = canvas.width;
    let targetHeight = canvas.height;

    if (targetWidth > maxWidth || targetHeight > maxWidth) {
      if (targetWidth > targetHeight) {
        targetHeight = Math.round((targetHeight * maxWidth) / targetWidth);
        targetWidth = maxWidth;
      } else {
        targetWidth = Math.round((targetWidth * maxWidth) / targetHeight);
        targetHeight = maxWidth;
      }
    }

    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = targetWidth;
    finalCanvas.height = targetHeight;
    const finalCtx = finalCanvas.getContext('2d');
    finalCtx.imageSmoothingEnabled = true;
    finalCtx.imageSmoothingQuality = 'high';
    finalCtx.drawImage(canvas, 0, 0, targetWidth, targetHeight);

    const dataUrl = finalCanvas.toDataURL('image/jpeg', 0.88);
    const isLandscape = targetWidth > targetHeight;

    pages.push({
      id: 'page_pdf_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now(),
      title: `Halaman ${i}`,
      originalName: `${file.name.replace(/\.pdf$/i, '')} - Hal ${i}`,
      width: targetWidth,
      height: targetHeight,
      originalWidth: canvas.width,
      originalHeight: canvas.height,
      orientation: isLandscape ? 'landscape' : 'portrait',
      aspectRatio: targetWidth / targetHeight,
      dataUrl: dataUrl,
      fileSize: Math.round(dataUrl.length * 0.75)
    });
  }

  return pages;
}
