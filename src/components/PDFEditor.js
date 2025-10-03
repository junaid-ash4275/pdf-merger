
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf';
import {
  FiUpload,
  FiFile,
  FiType,
  FiDroplet,
  FiTrash2,
  FiDownload,
  FiAlertCircle,
  FiCheckCircle,
  FiEdit3
} from 'react-icons/fi';

if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
  try {
    const workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '3.11.174'}/pdf.worker.min.js`;
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
  } catch (workerError) {
    console.warn('Failed to configure pdf.js worker. Page previews may not render correctly.', workerError);
  }
}

const cn = (...classes) => classes.filter(Boolean).join(' ');

const notificationStyles = {
  success: 'border-[rgba(255,107,53,0.3)] bg-[rgba(255,107,53,0.1)] text-brand-orange',
  error: 'border-[rgba(255,107,107,0.3)] bg-[rgba(255,107,107,0.1)] text-brand-error',
  info: 'border-[rgba(255,140,66,0.3)] bg-[rgba(255,140,66,0.1)] text-brand-orangeLight'
};

const hexToRgb = (hex) => {
  if (!hex) {
    return { r: 1, g: 1, b: 1 };
  }

  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) {
    return { r: 1, g: 1, b: 1 };
  }

  const bigint = parseInt(normalized, 16);
  return {
    r: ((bigint >> 16) & 255) / 255,
    g: ((bigint >> 8) & 255) / 255,
    b: (bigint & 255) / 255
  };
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const ensureUint8Array = (data) => {
  if (data instanceof Uint8Array) {
    return new Uint8Array(data);
  }

  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
  }

  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data.slice(0));
  }

  return new Uint8Array([]);
};

const generatePagePreviews = async (arrayBuffer) => {
  const pdfData = ensureUint8Array(arrayBuffer);
  const loadingTask = pdfjsLib.getDocument({ data: pdfData, disableWorker: true });
  const pdf = await loadingTask.promise;
  const entries = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const baseViewport = page.getViewport({ scale: 1 });
    const targetWidth = 580;
    const scale = Math.min(1.6, targetWidth / baseViewport.width || 1);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({ canvasContext: context, viewport }).promise;

    entries.push({
      id: `page-${pageNumber}`,
      pageNumber,
      pdfWidth: baseViewport.width,
      pdfHeight: baseViewport.height,
      renderWidth: viewport.width,
      renderHeight: viewport.height,
      thumbnail: canvas.toDataURL('image/png'),
      annotations: []
    });

    canvas.width = 0;
    canvas.height = 0;
  }

  pdf.cleanup();
  pdf.destroy();

  return {
    pdfData,
    pages: entries
  };
};
const PDFEditor = () => {
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [notification, setNotification] = useState(null);
  const [pdfDetails, setPdfDetails] = useState(null);
  const [originalPdfBytes, setOriginalPdfBytes] = useState(null);
  const [pages, setPages] = useState([]);
  const [activePageId, setActivePageId] = useState(null);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState(null);
  const [downloadPayload, setDownloadPayload] = useState(null);

  const showNotification = useCallback((message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3200);
  }, []);

  useEffect(() => {
    return () => {
      if (downloadPayload?.url) {
        URL.revokeObjectURL(downloadPayload.url);
      }
    };
  }, [downloadPayload]);

  const resetEditor = useCallback(() => {
    setPdfDetails(null);
    setOriginalPdfBytes(null);
    setPages([]);
    setActivePageId(null);
    setSelectedAnnotationId(null);
    setLoading(false);
    setProcessing(false);
    setDownloadPayload((previous) => {
      if (previous?.url) {
        URL.revokeObjectURL(previous.url);
      }
      return null;
    });
    showNotification('Editor reset', 'info');
  }, [showNotification]);

  const onDrop = useCallback(
    async (acceptedFiles) => {
      const pdfFile = acceptedFiles.find((file) => file.type === 'application/pdf');
      if (!pdfFile) {
        showNotification('Please select a PDF file to continue.', 'error');
        return;
      }

      setLoading(true);

      try {
        const arrayBuffer = await pdfFile.arrayBuffer();
        const { pdfData, pages: previewPages } = await generatePagePreviews(arrayBuffer);

        setPdfDetails({
          name: pdfFile.name,
          size: `${(pdfFile.size / 1024 / 1024).toFixed(2)} MB`,
          totalPages: previewPages.length
        });
        setOriginalPdfBytes(pdfData);
        setPages(previewPages);
        setActivePageId(previewPages[0]?.id ?? null);
        setSelectedAnnotationId(previewPages[0]?.annotations[0]?.id ?? null);
        setDownloadPayload((previous) => {
          if (previous?.url) {
            URL.revokeObjectURL(previous.url);
          }
          return null;
        });

        showNotification('PDF ready for editing.', 'success');
      } catch (error) {
        console.error('Error preparing PDF for editing:', error);
        showNotification('Could not read this PDF. Please try another file.', 'error');
      } finally {
        setLoading(false);
      }
    },
    [showNotification]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    multiple: false
  });

  const activePage = useMemo(() => pages.find((page) => page.id === activePageId) ?? null, [pages, activePageId]);

  useEffect(() => {
    if (!activePage) {
      setSelectedAnnotationId(null);
      return;
    }

    if (selectedAnnotationId && !activePage.annotations.some((annotation) => annotation.id === selectedAnnotationId)) {
      setSelectedAnnotationId(activePage.annotations[0]?.id ?? null);
    }
  }, [activePage, selectedAnnotationId]);

  const addTextAnnotation = useCallback(() => {
    if (!activePageId) {
      showNotification('Select a page before adding text.', 'info');
      return;
    }

    const newAnnotation = {
      id: `text-${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`,
      type: 'text',
      text: 'New text',
      fontSize: 18,
      color: '#FF6B35',
      positionX: 8,
      positionY: 10,
      opacity: 1
    };

    setPages((previous) =>
      previous.map((page) => {
        if (page.id !== activePageId) {
          return page;
        }

        return {
          ...page,
          annotations: [...page.annotations, newAnnotation]
        };
      })
    );

    setSelectedAnnotationId(newAnnotation.id);
    showNotification('Text box added.', 'success');
  }, [activePageId, showNotification]);

  const addHighlightAnnotation = useCallback(() => {
    if (!activePageId) {
      showNotification('Select a page before adding highlights.', 'info');
      return;
    }

    const newAnnotation = {
      id: `highlight-${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`,
      type: 'highlight',
      color: '#FFE066',
      positionX: 12,
      positionY: 18,
      width: 60,
      height: 14,
      opacity: 0.35
    };

    setPages((previous) =>
      previous.map((page) => {
        if (page.id !== activePageId) {
          return page;
        }

        return {
          ...page,
          annotations: [...page.annotations, newAnnotation]
        };
      })
    );

    setSelectedAnnotationId(newAnnotation.id);
    showNotification('Highlight added.', 'success');
  }, [activePageId, showNotification]);

  const updateAnnotation = useCallback((pageId, annotationId, updates) => {
    setPages((previous) =>
      previous.map((page) => {
        if (page.id !== pageId) {
          return page;
        }

        return {
          ...page,
          annotations: page.annotations.map((annotation) =>
            annotation.id === annotationId ? { ...annotation, ...updates } : annotation
          )
        };
      })
    );
  }, []);

  const removeAnnotation = useCallback(
    (pageId, annotationId) => {
      let nextSelection = selectedAnnotationId;

      setPages((previous) =>
        previous.map((page) => {
          if (page.id !== pageId) {
            return page;
          }

          const filtered = page.annotations.filter((annotation) => annotation.id !== annotationId);

          if (page.id === activePageId && selectedAnnotationId === annotationId) {
            nextSelection = filtered[0]?.id ?? null;
          }

          return {
            ...page,
            annotations: filtered
          };
        })
      );

      if (selectedAnnotationId === annotationId) {
        setSelectedAnnotationId(nextSelection);
      }

      showNotification('Annotation removed.', 'info');
    },
    [activePageId, selectedAnnotationId, showNotification]
  );

  const processPdf = useCallback(async () => {
    if (!originalPdfBytes) {
      showNotification('Upload a PDF before exporting.', 'info');
      return;
    }

    setProcessing(true);

    try {
      const pdfDoc = await PDFDocument.load(originalPdfBytes);
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

      pages.forEach((pageInfo) => {
        if (pageInfo.annotations.length === 0) {
          return;
        }

        const page = pdfDoc.getPage(pageInfo.pageNumber - 1);
        const pageWidth = page.getWidth();
        const pageHeight = page.getHeight();

        pageInfo.annotations.forEach((annotation) => {
          if (annotation.type === 'text') {
            const { r, g, b } = hexToRgb(annotation.color);
            const fontSize = clamp(annotation.fontSize ?? 12, 6, 96);
            const opacity = clamp(annotation.opacity ?? 1, 0, 1);
            const safeX = clamp(annotation.positionX ?? 0, 0, 100);
            const safeY = clamp(annotation.positionY ?? 0, 0, 100);
            const originX = (safeX / 100) * pageWidth;
            const originYTop = (safeY / 100) * pageHeight;
            const textLines = (annotation.text || '').split(/\r?\n/);

            textLines.forEach((line, index) => {
              const lineY = originYTop + index * fontSize;
              const drawY = pageHeight - lineY - fontSize;

              page.drawText(line, {
                x: originX,
                y: drawY,
                size: fontSize,
                font,
                color: rgb(r, g, b),
                opacity
              });
            });
          }

          if (annotation.type === 'highlight') {
            const { r, g, b } = hexToRgb(annotation.color);
            const safeX = clamp(annotation.positionX ?? 0, 0, 100);
            const safeY = clamp(annotation.positionY ?? 0, 0, 100);
            const rectWidth = (clamp(annotation.width ?? 10, 1, 100) / 100) * pageWidth;
            const rectHeight = (clamp(annotation.height ?? 10, 1, 100) / 100) * pageHeight;
            const originX = (safeX / 100) * pageWidth;
            const originYTop = (safeY / 100) * pageHeight;
            const drawY = pageHeight - originYTop - rectHeight;

            page.drawRectangle({
              x: originX,
              y: drawY,
              width: rectWidth,
              height: rectHeight,
              color: rgb(r, g, b),
              opacity: clamp(annotation.opacity ?? 0.35, 0, 1),
              borderWidth: 0
            });
          }
        });
      });

      const editedBytes = await pdfDoc.save();
      const blob = new Blob([editedBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const outputName = pdfDetails?.name ? pdfDetails.name.replace(/\.pdf$/i, '') + '-edited.pdf' : 'edited.pdf';

      setDownloadPayload((previous) => {
        if (previous?.url) {
          URL.revokeObjectURL(previous.url);
        }
        return {
          url,
          name: outputName
        };
      });

      showNotification('Edited PDF ready to download.', 'success');
    } catch (error) {
      console.error('Error generating edited PDF:', error);
      showNotification('Could not generate edited PDF. Please try again.', 'error');
    } finally {
      setProcessing(false);
    }
  }, [originalPdfBytes, pages, pdfDetails, showNotification]);

  const hasAnnotations = pages.some((page) => page.annotations.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <motion.div
        {...getRootProps()}
        className={cn(
          'group relative flex flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed px-6 py-10 text-center transition duration-300 sm:px-10',
          'bg-black/30 hover:border-brand-orange/40 hover:bg-black/40',
          isDragActive && 'border-brand-orange/60 bg-black/50',
          pdfDetails && 'border-white/15 bg-black/40'
        )}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <input {...getInputProps()} />
        <motion.div
          className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-orange/15 text-3xl text-brand-orange shadow-[0_12px_40px_rgba(255,107,53,0.2)]"
          animate={{ scale: isDragActive ? 1.05 : 1 }}
        >
          <FiUpload />
        </motion.div>
        <div className="flex flex-col gap-1">
          <h3 className="text-xl font-semibold text-white/90">{pdfDetails ? 'Replace PDF' : 'Upload a PDF to edit'}</h3>
          <p className="text-sm text-white/60">
            {loading
              ? 'Preparing your PDF...'
              : 'Drag & drop a file here, or click to browse. We keep all processing in your browser.'}
          </p>
        </div>
        {pdfDetails && (
          <div className="mt-3 flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70">
            <span className="flex items-center gap-2">
              <FiFile />
              {pdfDetails.name}
            </span>
            <span className="rounded-full bg-black/50 px-3 py-1 text-xs uppercase tracking-wide text-white/50">
              {pdfDetails.size}
            </span>
            <span className="rounded-full bg-black/50 px-3 py-1 text-xs uppercase tracking-wide text-white/50">
              {pdfDetails.totalPages} page(s)
            </span>
          </div>
        )}
      </motion.div>

      <AnimatePresence>
        {pdfDetails && (
          <motion.div
            className="flex flex-col gap-6"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            {notification && (
              <motion.div
                className={cn(
                  'flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm shadow-[0_10px_40px_rgba(0,0,0,0.25)]',
                  notificationStyles[notification.type] ?? notificationStyles.info
                )}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
              >
                {notification.type === 'error' ? <FiAlertCircle /> : <FiCheckCircle />}
                <span>{notification.message}</span>
              </motion.div>
            )}

            <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-black/30 p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="flex items-center gap-2 text-lg font-semibold text-white/90">
                      <FiEdit3 />
                      Edit Page Content
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={addTextAnnotation}
                        className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white/80 transition duration-300 hover:-translate-y-0.5 hover:border-white/30 hover:bg-white/15"
                      >
                        <FiType />
                        Add text box
                      </button>
                      <button
                        type="button"
                        onClick={addHighlightAnnotation}
                        className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white/80 transition duration-300 hover:-translate-y-0.5 hover:border-white/30 hover:bg-white/15"
                      >
                        <FiDroplet />
                        Add highlight
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-black/40 p-4">
                    {activePage ? (
                      <>
                        <div className="relative mx-auto w-full max-w-[620px] overflow-hidden rounded-2xl border border-white/10 bg-black/50 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
                          <img
                            src={activePage.thumbnail}
                            alt={`Page ${activePage.pageNumber} preview`}
                            className="w-full select-none"
                          />
                          <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/70">
                            Page {activePage.pageNumber} / {pdfDetails.totalPages}
                          </div>

                          <div className="absolute inset-0">
                            {activePage.annotations.map((annotation) => {
                              if (annotation.type === 'text') {
                                const previewFontSize =
                                  (annotation.fontSize ?? 14) *
                                  (activePage.renderHeight / activePage.pdfHeight);

                                return (
                                  <button
                                    key={annotation.id}
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setSelectedAnnotationId(annotation.id);
                                    }}
                                    className={cn(
                                      'absolute whitespace-pre-wrap rounded-lg border px-2 py-1 text-left font-medium text-white/90 shadow-[0_6px_20px_rgba(0,0,0,0.35)] outline-none transition duration-200',
                                      selectedAnnotationId === annotation.id
                                        ? 'border-brand-orange/80 bg-brand-orange/20'
                                        : 'border-transparent bg-black/40'
                                    )}
                                    style={{
                                      left: `${clamp(annotation.positionX ?? 0, 0, 100)}%`,
                                      top: `${clamp(annotation.positionY ?? 0, 0, 100)}%`,
                                      transform: 'translate(0, 0)',
                                      fontSize: `${Math.max(10, previewFontSize)}px`,
                                      color: annotation.color,
                                      opacity: clamp(annotation.opacity ?? 1, 0, 1),
                                      pointerEvents: 'auto'
                                    }}
                                  >
                                    {annotation.text || 'Text'}
                                  </button>
                                );
                              }

                              if (annotation.type === 'highlight') {
                                return (
                                  <button
                                    key={annotation.id}
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setSelectedAnnotationId(annotation.id);
                                    }}
                                    className={cn(
                                      'absolute rounded-xl border border-transparent outline-none transition duration-200',
                                      selectedAnnotationId === annotation.id && 'border-brand-orange/60'
                                    )}
                                    style={{
                                      left: `${clamp(annotation.positionX ?? 0, 0, 100)}%`,
                                      top: `${clamp(annotation.positionY ?? 0, 0, 100)}%`,
                                      width: `${clamp(annotation.width ?? 10, 1, 100)}%`,
                                      height: `${clamp(annotation.height ?? 10, 1, 100)}%`,
                                      backgroundColor: annotation.color,
                                      opacity: clamp(annotation.opacity ?? 0.35, 0, 1),
                                      pointerEvents: 'auto'
                                    }}
                                  />
                                );
                              }

                              return null;
                            })}
                          </div>
                        </div>
                      </>
                    ) : (
                      <p className="text-center text-sm text-white/50">
                        Select a page to start editing.
                      </p>
                    )}
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                    <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white/50">
                      Pages
                    </h4>
                    <div className="grid max-h-[260px] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3">
                      {pages.map((page) => (
                        <button
                          key={page.id}
                          type="button"
                          onClick={() => setActivePageId(page.id)}
                          className={cn(
                            'relative overflow-hidden rounded-xl border transition duration-200',
                            activePageId === page.id
                              ? 'border-brand-orange/70 shadow-[0_14px_30px_rgba(255,107,53,0.2)]'
                              : 'border-white/10 hover:border-brand-orange/40'
                          )}
                        >
                          <img src={page.thumbnail} alt={`Page ${page.pageNumber}`} className="w-full" />
                          <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] uppercase tracking-wide text-white/60">
                            {page.pageNumber}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-black/30 p-6">
                  <h3 className="text-lg font-semibold text-white/90">Annotation settings</h3>

                  {!activePage || activePage.annotations.length === 0 ? (
                    <p className="text-sm text-white/60">
                      Add text boxes or highlights to configure their appearance here.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {activePage.annotations.map((annotation) => (
                        <div
                          key={annotation.id}
                          onClick={() => setSelectedAnnotationId(annotation.id)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              setSelectedAnnotationId(annotation.id);
                            }
                          }}
                          className={cn(
                            'flex flex-col gap-3 rounded-xl border border-white/10 bg-black/40 p-4 outline-none transition duration-200 focus:border-brand-orange/60',
                            selectedAnnotationId === annotation.id && 'border-brand-orange/60 bg-brand-orange/10'
                          )}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 text-sm font-semibold text-white/80">
                              <span
                                className={cn(
                                  'flex h-8 w-8 items-center justify-center rounded-xl',
                                  annotation.type === 'text'
                                    ? 'bg-brand-orange/15 text-brand-orange'
                                    : 'bg-[#FFE066]/10 text-[#FFE066]'
                                )}
                              >
                                {annotation.type === 'text' ? <FiType /> : <FiDroplet />}
                              </span>
                              {annotation.type === 'text' ? 'Text box' : 'Highlight'}
                            </div>
                            <button
                              type="button"
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[rgba(255,107,107,0.4)] bg-[rgba(255,107,107,0.12)] text-brand-error transition duration-200 hover:scale-110 hover:border-brand-error hover:bg-[rgba(255,107,107,0.2)]"
                              onClick={(event) => {
                                event.stopPropagation();
                                removeAnnotation(activePage.id, annotation.id);
                              }}
                              title="Remove annotation"
                            >
                              <FiTrash2 />
                            </button>
                          </div>

                          {annotation.type === 'text' && (
                            <>
                              <div className="flex flex-col gap-2">
                                <label className="text-xs font-medium uppercase tracking-wide text-white/50">
                                  Text content
                                </label>
                                <textarea
                                  value={annotation.text}
                                  onChange={(event) =>
                                    updateAnnotation(activePage.id, annotation.id, { text: event.target.value })
                                  }
                                  rows={3}
                                  className="rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-sm text-white/90 outline-none transition duration-200 focus:border-brand-orange focus:ring-4 focus:ring-[rgba(255,107,53,0.2)]"
                                />
                              </div>

                              <div className="flex flex-col gap-2">
                                <label className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-white/50">
                                  Font size
                                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/60">
                                    {annotation.fontSize} pt
                                  </span>
                                </label>
                                <input
                                  type="range"
                                  min="8"
                                  max="96"
                                  value={annotation.fontSize}
                                  onChange={(event) =>
                                    updateAnnotation(activePage.id, annotation.id, {
                                      fontSize: Number(event.target.value)
                                    })
                                  }
                                />
                              </div>

                              <div className="flex flex-wrap gap-3">
                                <div className="flex flex-1 flex-col gap-2">
                                  <label className="text-xs font-medium uppercase tracking-wide text-white/50">
                                    Text color
                                  </label>
                                  <input
                                    type="color"
                                    value={annotation.color}
                                    onChange={(event) =>
                                      updateAnnotation(activePage.id, annotation.id, { color: event.target.value })
                                    }
                                    className="h-10 w-full cursor-pointer rounded-lg border border-white/20 bg-black/40"
                                  />
                                </div>
                                <div className="flex flex-1 flex-col gap-2">
                                  <label className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-white/50">
                                    Opacity
                                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/60">
                                      {Math.round((annotation.opacity ?? 1) * 100)}%
                                    </span>
                                  </label>
                                  <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.05"
                                    value={annotation.opacity ?? 1}
                                    onChange={(event) =>
                                      updateAnnotation(activePage.id, annotation.id, {
                                        opacity: Number(event.target.value)
                                      })
                                    }
                                  />
                                </div>
                              </div>
                            </>
                          )}

                          {annotation.type === 'highlight' && (
                            <>
                              <div className="flex flex-wrap gap-3">
                                <div className="flex flex-1 flex-col gap-2">
                                  <label className="text-xs font-medium uppercase tracking-wide text-white/50">
                                    Fill color
                                  </label>
                                  <input
                                    type="color"
                                    value={annotation.color}
                                    onChange={(event) =>
                                      updateAnnotation(activePage.id, annotation.id, { color: event.target.value })
                                    }
                                    className="h-10 w-full cursor-pointer rounded-lg border border-white/20 bg-black/40"
                                  />
                                </div>
                                <div className="flex flex-1 flex-col gap-2">
                                  <label className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-white/50">
                                    Opacity
                                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/60">
                                      {Math.round((annotation.opacity ?? 0.35) * 100)}%
                                    </span>
                                  </label>
                                  <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.05"
                                    value={annotation.opacity ?? 0.35}
                                    onChange={(event) =>
                                      updateAnnotation(activePage.id, annotation.id, {
                                        opacity: Number(event.target.value)
                                      })
                                    }
                                  />
                                </div>
                              </div>

                              <div className="flex flex-wrap gap-3">
                                <div className="flex flex-1 flex-col gap-2">
                                  <label className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-white/50">
                                    Width
                                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/60">
                                      {Math.round(annotation.width)}%
                                    </span>
                                  </label>
                                  <input
                                    type="range"
                                    min="5"
                                    max="100"
                                    value={annotation.width}
                                    onChange={(event) =>
                                      updateAnnotation(activePage.id, annotation.id, {
                                        width: Number(event.target.value)
                                      })
                                    }
                                  />
                                </div>
                                <div className="flex flex-1 flex-col gap-2">
                                  <label className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-white/50">
                                    Height
                                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/60">
                                      {Math.round(annotation.height)}%
                                    </span>
                                  </label>
                                  <input
                                    type="range"
                                    min="5"
                                    max="100"
                                    value={annotation.height}
                                    onChange={(event) =>
                                      updateAnnotation(activePage.id, annotation.id, {
                                        height: Number(event.target.value)
                                      })
                                    }
                                  />
                                </div>
                              </div>
                            </>
                          )}

                          <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col gap-2">
                              <label className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-white/50">
                                Horizontal position
                                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/60">
                                  {Math.round(annotation.positionX)}%
                                </span>
                              </label>
                              <input
                                type="range"
                                min="0"
                                max="100"
                                value={annotation.positionX}
                                onChange={(event) =>
                                  updateAnnotation(activePage.id, annotation.id, {
                                    positionX: Number(event.target.value)
                                  })
                                }
                              />
                            </div>
                            <div className="flex flex-col gap-2">
                              <label className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-white/50">
                                Vertical position
                                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/60">
                                  {Math.round(annotation.positionY)}%
                                </span>
                              </label>
                              <input
                                type="range"
                                min="0"
                                max="100"
                                value={annotation.positionY}
                                onChange={(event) =>
                                  updateAnnotation(activePage.id, annotation.id, {
                                    positionY: Number(event.target.value)
                                  })
                                }
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/30 p-6">
                  <h3 className="text-lg font-semibold text-white/90">Export</h3>
                  <p className="text-sm text-white/60">
                    {hasAnnotations
                      ? 'When you are ready, export the edited PDF and download it instantly.'
                      : 'You have not added any edits yet. Exporting will simply copy the original PDF.'}
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={processPdf}
                      disabled={processing || !originalPdfBytes}
                      className="group/button relative flex min-w-[160px] flex-1 items-center justify-center gap-2 overflow-hidden rounded-xl border-none bg-gradient-orange px-6 py-3 text-sm font-semibold text-white shadow-action transition duration-300 hover:-translate-y-0.5 hover:shadow-action-hover disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span className="pointer-events-none absolute left-1/2 top-1/2 h-0 w-0 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/30 opacity-0 transition-all duration-500 group-hover/button:h-[220px] group-hover/button:w-[220px] group-hover/button:opacity-100" />
                      {processing ? (
                        <>
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                          Preparing…
                        </>
                      ) : (
                        <>
                          <FiDownload />
                          Export edited PDF
                        </>
                      )}
                    </button>

                    {downloadPayload && (
                      <a
                        href={downloadPayload.url}
                        download={downloadPayload.name}
                        className="flex min-w-[140px] flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-success px-6 py-3 text-sm font-semibold text-white shadow-[0_4px_20px_rgba(76,175,80,0.3)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_6px_30px_rgba(76,175,80,0.4)]"
                      >
                        <FiDownload />
                        Download edited PDF
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={resetEditor}
                      className="flex min-w-[120px] items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white/80 transition duration-300 hover:-translate-y-0.5 hover:border-white/30 hover:bg-white/15"
                    >
                      Reset editor
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PDFEditor;

