import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf';
import {
  FiAlertCircle,
  FiCheckCircle,
  FiDownload,
  FiRotateCcw,
  FiScissors,
  FiTrash2,
  FiUpload
} from 'react-icons/fi';

if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
  try {
    const workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '3.11.174'}/pdf.worker.min.js`;
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
  } catch (workerError) {
    console.warn('Failed to configure pdf.js worker. Page thumbnails may not render correctly.', workerError);
  }
}

const notificationStyles = {
  success: 'border-[rgba(255,107,53,0.3)] bg-[rgba(255,107,53,0.1)] text-brand-orange',
  error: 'border-[rgba(255,107,107,0.3)] bg-[rgba(255,107,107,0.1)] text-brand-error',
  info: 'border-[rgba(255,140,66,0.3)] bg-[rgba(255,140,66,0.1)] text-brand-orangeLight'
};

const cn = (...classes) => classes.filter(Boolean).join(' ');

const ensureUint8Array = (data) => {
  if (data instanceof Uint8Array) {
    return data;
  }

  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }

  return new Uint8Array([]);
};

const PDFPageRemover = () => {
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [notification, setNotification] = useState(null);
  const [pdfInfo, setPdfInfo] = useState(null);
  const [pages, setPages] = useState([]);
  const [pdfBytes, setPdfBytes] = useState(null);
  const [downloadPayload, setDownloadPayload] = useState(null);

  const showNotification = useCallback((message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (downloadPayload?.url) {
        URL.revokeObjectURL(downloadPayload.url);
      }
    };
  }, [downloadPayload]);

  const updateDownloadPayload = useCallback((bytes, fileName) => {
    setDownloadPayload((previous) => {
      if (previous?.url) {
        URL.revokeObjectURL(previous.url);
      }

      const blob = bytes instanceof Blob ? bytes : new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      return {
        url,
        fileName: fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`
      };
    });
  }, []);

  const extractNameParts = useCallback((fileName) => {
    const lastDot = fileName.lastIndexOf('.');
    if (lastDot === -1) {
      return { base: fileName, extension: '' };
    }

    return {
      base: fileName.slice(0, lastDot),
      extension: fileName.slice(lastDot)
    };
  }, []);

  const generateThumbnails = useCallback(async (arrayBuffer) => {
    const pdfData = ensureUint8Array(arrayBuffer);
    const loadingTask = pdfjsLib.getDocument({ data: pdfData, disableWorker: true });
    const pdf = await loadingTask.promise;
    const entries = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const targetWidth = 220;
      const scale = Math.min(1.4, targetWidth / viewport.width || 1);
      const scaledViewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d', { willReadFrequently: true });
      canvas.width = scaledViewport.width;
      canvas.height = scaledViewport.height;

      await page.render({ canvasContext: context, viewport: scaledViewport }).promise;
      const thumbnail = canvas.toDataURL('image/png');
      entries.push({ pageNumber, thumbnail });
      canvas.width = 0;
      canvas.height = 0;
    }

    pdf.cleanup();
    pdf.destroy();

    return {
      totalPages: entries.length,
      pages: entries.map((entry) => ({
        pageNumber: entry.pageNumber,
        thumbnail: entry.thumbnail,
        selectedForRemoval: false
      }))
    };
  }, []);

  const [dropError, setDropError] = useState(null);

  const onDrop = useCallback(async (acceptedFiles) => {
    const pdfFile = acceptedFiles.find((file) => {
      if (file.type === 'application/pdf') {
        return true;
      }

      const lowerCaseName = file.name?.toLowerCase();
      return Boolean(lowerCaseName && lowerCaseName.endsWith('.pdf'));
    });

    if (!pdfFile) {
      setDropError('Please select a PDF file to continue.');
      showNotification('Please select a PDF file to continue.', 'error');
      return;
    }

    setDropError(null);
    setLoading(true);
    setProcessing(false);

    try {
      debugger;
      const arrayBuffer = await pdfFile.arrayBuffer();
      const { base, extension } = extractNameParts(pdfFile.name);
      const { totalPages, pages: pageEntries } = await generateThumbnails(arrayBuffer);

      setPdfInfo({
        name: pdfFile.name,
        baseName: base,
        extension: extension || '.pdf',
        sizeLabel: `${(pdfFile.size / 1024 / 1024).toFixed(2)} MB`,
        totalPages
      });
      const typedArray = ensureUint8Array(arrayBuffer);
      setPages(pageEntries);
      setPdfBytes(typedArray);
      updateDownloadPayload(typedArray, pdfFile.name);

      showNotification(`Loaded ${totalPages} page(s) from ${pdfFile.name}`, 'success');
    } catch (error) {
      console.error('Error loading PDF for removal:', error);
      showNotification('Could not process this PDF. Please try another file.', 'error');
      setPdfInfo(null);
      setPages([]);
      setPdfBytes(null);
    } finally {
      setLoading(false);
    }
  }, [extractNameParts, generateThumbnails, showNotification, updateDownloadPayload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    multiple: false
  });

  const togglePageSelection = useCallback((pageNumber) => {
    setPages((previous) =>
      previous.map((page) =>
        page.pageNumber === pageNumber
          ? { ...page, selectedForRemoval: !page.selectedForRemoval }
          : page
      )
    );
  }, []);

  const selectedCount = useMemo(
    () => pages.filter((page) => page.selectedForRemoval).length,
    [pages]
  );

  const handleRemoveSelected = useCallback(async () => {
    if (!pdfBytes || !pdfInfo) {
      showNotification('Upload a PDF to modify first.', 'info');
      return;
    }

    if (selectedCount === 0) {
      showNotification('Select at least one page to remove.', 'info');
      return;
    }

    const pagesToKeep = pages.filter((page) => !page.selectedForRemoval);
    if (pagesToKeep.length === 0) {
      showNotification('Cannot remove all pages from the document.', 'error');
      return;
    }

    setProcessing(true);

    try {
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const indicesToKeep = pagesToKeep.map((page) => page.pageNumber - 1);
      const newDoc = await PDFDocument.create();
      const copiedPages = await newDoc.copyPages(pdfDoc, indicesToKeep);
      copiedPages.forEach((page) => newDoc.addPage(page));

      const newBytes = await newDoc.save();
      const { totalPages, pages: regeneratedPages } = await generateThumbnails(newBytes.buffer);

      setPdfBytes(newBytes);
      setPages(regeneratedPages);
      setPdfInfo((previous) =>
        previous
          ? {
            ...previous,
            totalPages,
            sizeLabel: `${(newBytes.byteLength / 1024 / 1024).toFixed(2)} MB`
          }
          : previous
      );
      updateDownloadPayload(newBytes, `${pdfInfo.baseName}-edited${pdfInfo.extension}`);

      showNotification(`Removed ${selectedCount} page(s).`, 'success');
    } catch (error) {
      console.error('Error removing pages from PDF:', error);
      showNotification('Something went wrong while removing pages.', 'error');
    } finally {
      setProcessing(false);
    }
  }, [generateThumbnails, pages, pdfBytes, pdfInfo, selectedCount, showNotification, updateDownloadPayload]);

  const downloadCurrentPdf = useCallback(() => {
    if (!downloadPayload?.url) {
      return;
    }

    const link = document.createElement('a');
    link.href = downloadPayload.url;
    link.download = downloadPayload.fileName || 'updated-document.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showNotification('Download started!', 'success');
  }, [downloadPayload, showNotification]);

  const resetTool = useCallback(() => {
    setPdfInfo(null);
    setPages([]);
    setPdfBytes(null);
    setProcessing(false);
    setDropError(null);
    setNotification(null);
    setDownloadPayload((previous) => {
      if (previous?.url) {
        URL.revokeObjectURL(previous.url);
      }
      return null;
    });
  }, []);

  const hasPdfLoaded = Boolean(pdfInfo && pages.length > 0);

  return (
    <div className="relative mx-auto w-full max-w-[960px]">
      <AnimatePresence>
        {notification && (
          <motion.div
            className={cn(
              'fixed right-5 top-5 z-50 flex items-center gap-2 rounded-xl px-6 py-4 font-medium backdrop-blur-xl shadow-merger-card',
              notificationStyles[notification.type] || notificationStyles.info
            )}
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            transition={{ duration: 0.3 }}
          >
            {notification.type === 'success' && <FiCheckCircle />}
            {notification.type === 'error' && <FiAlertCircle />}
            {notification.message}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        className="group relative overflow-hidden rounded-[24px] border border-[rgba(255,107,53,0.2)] bg-white/5 p-8 shadow-merger-card backdrop-blur-2xl transition"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <span className="pointer-events-none absolute -inset-[2px] -z-10 rounded-[24px] bg-gradient-orange opacity-0 transition duration-300 group-hover:opacity-30 group-hover:animate-glow-pulse"></span>

        <div
          {...getRootProps()}
          className={cn(
            'group/drop relative overflow-hidden rounded-2xl border-2 border-dashed border-[rgba(255,107,53,0.4)] bg-[rgba(255,107,53,0.05)] px-8 py-12 text-center transition-all duration-300 hover:border-[rgba(255,107,53,0.6)] hover:bg-[rgba(255,107,53,0.08)] hover:shadow-dropzone cursor-pointer',
            isDragActive && 'border-[rgba(255,107,53,0.8)] bg-[rgba(255,107,53,0.1)] shadow-dropzone',
            loading && 'cursor-progress opacity-80'
          )}
        >
          <input {...getInputProps()} disabled={loading || processing} />
          <div
            className={cn(
              'pointer-events-none absolute inset-0 bg-[radial-gradient(circle,rgba(255,107,53,0.12),transparent_70%)] transition-opacity duration-300',
              isDragActive ? 'opacity-100 animate-pulse-ring' : 'opacity-0 group-hover/drop:opacity-100'
            )}
          ></div>
          <div className="relative z-10 flex flex-col items-center gap-6">
            <FiUpload className="text-6xl text-brand-orange drop-shadow-icon animate-float-icon" />
            <div className="flex flex-col gap-2 text-white/80">
              <p className="text-[1.1rem]">
                {isDragActive
                  ? 'Drop your PDF file here to preview pages...'
                  : 'Drag & drop a PDF here, or click to select'}
              </p>
              <span className="text-sm text-white/50">We will render page thumbnails so you can remove the ones you don’t need.</span>
            </div>
            <button
              type="button"
              className="pointer-events-auto rounded-full bg-gradient-orange px-8 py-3 text-base font-semibold text-white shadow-action transition duration-300 hover:-translate-y-0.5 hover:bg-gradient-orange-strong hover:shadow-action-hover"
            >
              Select PDF File
            </button>
            {dropError && <p className="text-sm text-brand-error">{dropError}</p>}
          </div>

          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-3 text-white/80">
                <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white"></span>
                <span className="text-sm">Rendering page thumbnails...</span>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {hasPdfLoaded && !loading && (
        <motion.div
          className="group relative mt-10 overflow-hidden rounded-[24px] border border-[rgba(255,107,53,0.2)] bg-white/5 p-8 shadow-merger-card backdrop-blur-2xl transition"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <span className="pointer-events-none absolute -inset-[2px] -z-10 rounded-[24px] bg-gradient-orange opacity-0 transition duration-300 group-hover:opacity-30 group-hover:animate-glow-pulse"></span>

          <div className="flex flex-col gap-8">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 p-6 text-white/80">
              <div>
                <h3 className="text-xl font-semibold text-white/90">{pdfInfo.name}</h3>
                <p className="text-sm text-white/50">
                  {pdfInfo.totalPages} page(s) • {pdfInfo.sizeLabel}
                </p>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-white/70">
                <FiScissors className="text-brand-orange" />
                <span>
                  {selectedCount > 0
                    ? `${selectedCount} page(s) selected for removal`
                    : 'Click a page to mark it for removal'}
                </span>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {pages.map((page) => (
                <button
                  key={page.pageNumber}
                  type="button"
                  onClick={() => togglePageSelection(page.pageNumber)}
                  className={cn(
                    'group relative flex w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/20 transition duration-300 hover:-translate-y-1 hover:border-brand-orange/40 hover:bg-black/30 hover:shadow-merger-card',
                    page.selectedForRemoval && 'border-[rgba(255,107,107,0.6)] shadow-[0_10px_30px_rgba(255,107,107,0.25)]'
                  )}
                >
                  <div className="relative h-40 w-full overflow-hidden bg-black/20">
                    <img
                      src={page.thumbnail}
                      alt={`Page ${page.pageNumber}`}
                      className="h-full w-full object-contain"
                    />
                    <span className="absolute left-3 top-3 flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-sm font-semibold text-white/80 backdrop-blur">
                      {page.pageNumber}
                    </span>
                    {page.selectedForRemoval && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-[rgba(255,107,107,0.45)] backdrop-blur-sm">
                        <FiTrash2 className="text-2xl" />
                        <span className="mt-1 text-xs font-semibold uppercase tracking-wide">Marked</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between px-4 py-3 text-sm text-white/70">
                    <span>{page.selectedForRemoval ? 'Tap again to keep' : 'Tap to remove'}</span>
                    <FiScissors className={cn('transition duration-300', page.selectedForRemoval && 'rotate-45 text-brand-error')} />
                  </div>
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-4">
              <button
                type="button"
                onClick={handleRemoveSelected}
                disabled={processing || selectedCount === 0}
                className="group/button relative flex min-w-[160px] flex-1 items-center justify-center gap-2 overflow-hidden rounded-xl border-none bg-gradient-to-r from-[rgba(255,107,107,0.9)] to-[rgba(255,140,140,0.9)] px-7 py-3 text-base font-semibold text-white shadow-[0_10px_30px_rgba(255,107,107,0.35)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_40px_rgba(255,107,107,0.4)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="pointer-events-none absolute left-1/2 top-1/2 h-0 w-0 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/30 opacity-0 transition-all duration-500 group-hover/button:h-[260px] group-hover/button:w-[260px] group-hover/button:opacity-100"></span>
                {processing ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></span>
                    Removing...
                  </>
                ) : (
                  <>
                    <FiTrash2 />
                    Remove Selected Pages
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={downloadCurrentPdf}
                disabled={!downloadPayload || processing}
                className="flex min-w-[160px] flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-success px-7 py-3 text-base font-semibold text-white shadow-[0_4px_20px_rgba(76,175,80,0.3)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_6px_30px_rgba(76,175,80,0.4)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FiDownload />
                Download Current PDF
              </button>

              <button
                type="button"
                onClick={resetTool}
                className="flex min-w-[120px] items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-6 py-3 text-base font-semibold text-white/80 transition duration-300 hover:-translate-y-0.5 hover:border-white/30 hover:bg-white/15"
              >
                <FiRotateCcw />
                Reset
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default PDFPageRemover;
