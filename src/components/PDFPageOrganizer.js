import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { motion, AnimatePresence } from 'framer-motion';
import { PDFDocument, degrees } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf';
import {
  FiUpload,
  FiRefreshCcw,
  FiRotateCcw,
  FiRotateCw,
  FiCopy,
  FiTrash2,
  FiDownload,
  FiMove,
  FiAlertCircle,
  FiCheckCircle,
  FiCheckSquare,
  FiSquare
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

const extractNameParts = (fileName) => {
  const lastDot = fileName.lastIndexOf('.');
  if (lastDot === -1) {
    return { base: fileName, extension: '' };
  }

  return {
    base: fileName.slice(0, lastDot),
    extension: fileName.slice(lastDot)
  };
};

const generateThumbnails = async (arrayBuffer) => {
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
    pages: entries
  };
};

const PDFPageOrganizer = () => {
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [notification, setNotification] = useState(null);
  const [pdfInfo, setPdfInfo] = useState(null);
  const [pdfBytes, setPdfBytes] = useState(null);
  const [pages, setPages] = useState([]);
  const [downloadPayload, setDownloadPayload] = useState(null);

  const originalPagesRef = useRef([]);

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
    let payload = null;

    setDownloadPayload((previous) => {
      if (previous?.url) {
        URL.revokeObjectURL(previous.url);
      }

      const blob = bytes instanceof Blob ? bytes : new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      payload = {
        url,
        fileName: fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`
      };
      return payload;
    });

    return payload;
  }, []);

  const triggerDownload = useCallback((payload) => {
    if (!payload?.url) {
      return;
    }

    const link = document.createElement('a');
    link.href = payload.url;
    link.download = payload.fileName || 'organized-document.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const onDrop = useCallback(
    async (acceptedFiles) => {
      const pdfFile = acceptedFiles.find((file) => {
        if (file.type === 'application/pdf') {
          return true;
        }

        const lowerCaseName = file.name?.toLowerCase();
        return Boolean(lowerCaseName && lowerCaseName.endsWith('.pdf'));
      });

      if (!pdfFile) {
        showNotification('Please select a PDF file to continue.', 'error');
        return;
      }

      setLoading(true);
      setProcessing(false);

      try {
        const arrayBuffer = await pdfFile.arrayBuffer();
        const typedArray = ensureUint8Array(arrayBuffer);
        const pdfDoc = await PDFDocument.load(typedArray);
        const { pages: pageEntries } = await generateThumbnails(arrayBuffer);
        const { base, extension } = extractNameParts(pdfFile.name);

        const preparedPages = pageEntries.map((entry) => ({
          id: `page-${entry.pageNumber}-${Date.now()}-${Math.random()}`,
          label: `Page ${entry.pageNumber}`,
          sourceIndex: entry.pageNumber - 1,
          thumbnail: entry.thumbnail,
          rotation: 0,
          selected: false
        }));

        setPages(preparedPages);
        originalPagesRef.current = preparedPages.map((entry) => ({ ...entry }));
        setPdfBytes(typedArray);
        setPdfInfo({
          name: pdfFile.name,
          baseName: base,
          extension: extension || '.pdf',
          sizeLabel: `${(pdfFile.size / 1024 / 1024).toFixed(2)} MB`,
          totalPages: pdfDoc.getPageCount()
        });
        showNotification(`Loaded ${pdfDoc.getPageCount()} page(s) from ${pdfFile.name}`, 'success');
      } catch (error) {
        console.error('Error loading PDF for organizing:', error);
        showNotification('Could not process this PDF. Please try another file.', 'error');
        setPdfInfo(null);
        setPdfBytes(null);
        setPages([]);
        originalPagesRef.current = [];
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
    multiple: false,
    disabled: loading || processing
  });

  const onDragEnd = useCallback(
    (result) => {
      if (!result.destination) return;

      setPages((previous) => {
        const items = Array.from(previous);
        const [moved] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, moved);
        return items;
      });
    },
    []
  );

  const rotatePage = useCallback((id, direction) => {
    const delta = direction === 'left' ? -90 : 90;
    setPages((previous) =>
      previous.map((page) => {
        if (page.id !== id) {
          return page;
        }
        const newRotation = (page.rotation + delta + 360) % 360;
        return { ...page, rotation: newRotation };
      })
    );
  }, []);

  const duplicatePage = useCallback((id) => {
    setPages((previous) => {
      const index = previous.findIndex((page) => page.id === id);
      if (index === -1) {
        return previous;
      }

      const original = previous[index];
      const duplicate = {
        ...original,
        id: `page-${original.sourceIndex}-${Date.now()}-${Math.random()}`,
        selected: false
      };

      const items = Array.from(previous);
      items.splice(index + 1, 0, duplicate);
      return items;
    });
  }, []);

  const removePage = useCallback(
    (id) => {
      setPages((previous) => {
        if (previous.length <= 1) {
          showNotification('Document must contain at least one page.', 'error');
          return previous;
        }
        return previous.filter((page) => page.id !== id);
      });
    },
    [showNotification]
  );

  const toggleSelection = useCallback((id) => {
    setPages((previous) =>
      previous.map((page) =>
        page.id === id
          ? {
              ...page,
              selected: !page.selected
            }
          : page
      )
    );
  }, []);

  const selectAll = useCallback(() => {
    setPages((previous) => previous.map((page) => ({ ...page, selected: true })));
  }, []);

  const clearSelection = useCallback(() => {
    setPages((previous) => previous.map((page) => ({ ...page, selected: false })));
  }, []);

  const restoreOriginalArrangement = useCallback(() => {
    if (originalPagesRef.current.length === 0) {
      return;
    }
    setPages(originalPagesRef.current.map((entry) => ({ ...entry })));
    showNotification('Restored original page order.', 'info');
  }, [showNotification]);

  const handleExport = useCallback(
    async ({ selectionOnly = false } = {}) => {
      if (!pdfBytes || !pdfInfo) {
        showNotification('Upload a PDF to organize first.', 'info');
        return;
      }

      const targetPages = selectionOnly ? pages.filter((page) => page.selected) : pages;

      if (targetPages.length === 0) {
        showNotification('Select at least one page to export.', 'info');
        return;
      }

      setProcessing(true);
      try {
        const originalDoc = await PDFDocument.load(pdfBytes);
        const outputDoc = await PDFDocument.create();

        for (const entry of targetPages) {
          const [copiedPage] = await outputDoc.copyPages(originalDoc, [entry.sourceIndex]);
          if (entry.rotation) {
            copiedPage.setRotation(degrees(entry.rotation));
          }
          outputDoc.addPage(copiedPage);
        }

        const newBytes = await outputDoc.save();
        const suffix = selectionOnly ? 'selection' : 'organized';
        const payload = updateDownloadPayload(
          newBytes,
          `${pdfInfo.baseName || 'document'}-${suffix}${pdfInfo.extension || '.pdf'}`
        );

        triggerDownload(payload);
        showNotification('Download started!', 'success');
      } catch (error) {
        console.error('Error exporting organized PDF:', error);
        showNotification('Something went wrong while exporting. Please try again.', 'error');
      } finally {
        setProcessing(false);
      }
    },
    [pages, pdfBytes, pdfInfo, triggerDownload, updateDownloadPayload, showNotification]
  );

  const downloadLastExport = useCallback(() => {
    if (!downloadPayload) {
      showNotification('No export available yet.', 'info');
      return;
    }

    triggerDownload(downloadPayload);
    showNotification('Download started!', 'success');
  }, [downloadPayload, triggerDownload, showNotification]);

  const resetTool = useCallback(() => {
    setLoading(false);
    setProcessing(false);
    setNotification(null);
    setPdfInfo(null);
    setPdfBytes(null);
    setPages([]);
    originalPagesRef.current = [];
    setDownloadPayload((previous) => {
      if (previous?.url) {
        URL.revokeObjectURL(previous.url);
      }
      return null;
    });
  }, []);

  const hasPdfLoaded = useMemo(() => Boolean(pdfInfo && pages.length > 0), [pdfInfo, pages.length]);
  const selectedCount = useMemo(() => pages.filter((page) => page.selected).length, [pages]);

  return (
    <div className="relative mx-auto w-full max-w-[1200px]">
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
            (loading || processing) && 'cursor-progress opacity-80'
          )}
        >
          <input {...getInputProps()} />
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
                {isDragActive ? 'Drop your PDF file to rearrange pages...' : 'Drag & drop a PDF here, or click to select'}
              </p>
              <span className="text-sm text-white/50">
                We will generate thumbnails so you can reorder, rotate, duplicate, or select pages for export.
              </span>
            </div>
            <button
              type="button"
              className="pointer-events-auto rounded-full bg-gradient-orange px-8 py-3 text-base font-semibold text-white shadow-action transition duration-300 hover:-translate-y-0.5 hover:bg-gradient-orange-strong hover:shadow-action-hover"
            >
              Select PDF File
            </button>
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
                  {pages.length} page(s) • {pdfInfo.sizeLabel}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-white/60">
                <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-white/70">
                  <FiRefreshCcw className="text-brand-orange" />
                  <span>Drag to reorder • Rotate • Duplicate • Select</span>
                </div>
                <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2">
                  <button
                    type="button"
                    onClick={selectAll}
                    disabled={processing}
                    className="text-xs font-semibold text-white/70 transition duration-300 hover:text-white disabled:opacity-60"
                  >
                    Select all
                  </button>
                  <span className="text-white/30">|</span>
                  <button
                    type="button"
                    onClick={clearSelection}
                    disabled={processing || selectedCount === 0}
                    className="text-xs font-semibold text-white/70 transition duration-300 hover:text-white disabled:opacity-60"
                  >
                    Clear selection
                  </button>
                </div>
                <button
                  type="button"
                  onClick={restoreOriginalArrangement}
                  disabled={processing}
                  className="flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold text-white/70 transition duration-300 hover:-translate-y-0.5 hover:border-white/25 hover:text-white disabled:opacity-60"
                >
                  <FiRefreshCcw className="text-brand-orange" />
                  Restore original order
                </button>
              </div>
            </div>

            <DragDropContext onDragEnd={onDragEnd}>
              <Droppable droppableId="organizer-pages" direction="horizontal">
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(
                      'grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
                      snapshot.isDraggingOver && 'bg-[rgba(255,107,53,0.05)] rounded-2xl p-2'
                    )}
                  >
                    {pages.map((page, index) => (
                      <Draggable key={page.id} draggableId={page.id} index={index}>
                        {(dragProvided, dragSnapshot) => {
                          const baseStyle = dragProvided.draggableProps.style || {};
                          const baseTransform = baseStyle.transform;
                          const dragStyle = {
                            ...baseStyle,
                            opacity: dragSnapshot.isDragging ? 0.85 : 1,
                            transform: dragSnapshot.isDragging && baseTransform
                              ? `${baseTransform} rotate(2deg)`
                              : baseTransform,
                            cursor: dragSnapshot.isDragging ? 'grabbing' : 'grab'
                          };

                          return (
                            <div
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              className={cn(
                                'group/card relative flex w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/20 transition duration-300 hover:-translate-y-1 hover:border-brand-orange/40 hover:bg-black/30 hover:shadow-merger-card',
                                page.selected && 'border-[rgba(255,107,53,0.6)] shadow-[0_10px_30px_rgba(255,107,53,0.25)]'
                              )}
                              style={dragStyle}
                            >
                              <div className="absolute left-3 top-3 flex items-center gap-2">
                                <button
                                  type="button"
                                  {...dragProvided.dragHandleProps}
                                  className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-white/60 transition duration-300 hover:bg-brand-orange/20 hover:text-brand-orange"
                                  title="Drag to reorder"
                                  disabled={processing}
                                >
                                  <FiMove />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => toggleSelection(page.id)}
                                  className={cn(
                                    'flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-white/70 transition duration-300 hover:bg-brand-orange/20 hover:text-brand-orange',
                                    page.selected && 'bg-brand-orange/25 text-brand-orange'
                                  )}
                                  title={page.selected ? 'Deselect page' : 'Select page'}
                                  disabled={processing}
                                >
                                  {page.selected ? <FiCheckSquare /> : <FiSquare />}
                                </button>
                              </div>

                              <div className="relative h-56 w-full overflow-hidden rounded-2xl bg-black/15">
                                <img
                                  src={page.thumbnail}
                                  alt={page.label}
                                  className="h-full w-full object-contain p-3 transition duration-300"
                                  style={{ transform: `rotate(${page.rotation}deg)` }}
                                />
                                <span className="absolute right-3 bottom-3 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/70 backdrop-blur">
                                  Position {index + 1}
                                </span>
                              </div>

                              <div className="flex flex-col gap-3 px-4 py-4 text-sm text-white/70">
                                <div className="flex items-center justify-between text-xs text-white/50">
                                  <span>Original page {page.sourceIndex + 1}</span>
                                  <span>Rotation {page.rotation}°</span>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => rotatePage(page.id, 'left')}
                                    disabled={processing}
                                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white/70 transition duration-300 hover:-translate-y-0.5 hover:border-brand-orange/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    <FiRotateCcw />
                                    Rotate left
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => rotatePage(page.id, 'right')}
                                    disabled={processing}
                                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white/70 transition duration-300 hover:-translate-y-0.5 hover:border-brand-orange/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    <FiRotateCw />
                                    Rotate right
                                  </button>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => duplicatePage(page.id)}
                                    disabled={processing}
                                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white/70 transition duration-300 hover:-translate-y-0.5 hover:border-brand-orange/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    <FiCopy />
                                    Duplicate
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removePage(page.id)}
                                    disabled={processing || pages.length <= 1}
                                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[rgba(255,107,107,0.4)] bg-[rgba(255,107,107,0.12)] px-3 py-2 text-xs font-semibold text-white/80 transition duration-300 hover:-translate-y-0.5 hover:border-brand-error hover:bg-[rgba(255,107,107,0.2)] disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    <FiTrash2 />
                                    Remove
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        }}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>

            <div className="flex flex-wrap gap-4">
              <button
                type="button"
                onClick={() => handleExport({ selectionOnly: false })}
                disabled={processing}
                className="group/button relative flex min-w-[180px] flex-1 items-center justify-center gap-2 overflow-hidden rounded-xl border-none bg-gradient-orange px-7 py-3 text-base font-semibold text-white shadow-action transition duration-300 hover:-translate-y-0.5 hover:shadow-action-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="pointer-events-none absolute left-1/2 top-1/2 h-0 w-0 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/30 opacity-0 transition-all duration-500 group-hover/button:h-[260px] group-hover/button:w-[260px] group-hover/button:opacity-100"></span>
                {processing ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></span>
                    Preparing...
                  </>
                ) : (
                  <>
                    <FiDownload />
                    Download arranged PDF
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => handleExport({ selectionOnly: true })}
                disabled={processing || selectedCount === 0}
                className="flex min-w-[180px] flex-1 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-7 py-3 text-base font-semibold text-white/80 transition duration-300 hover:-translate-y-0.5 hover:border-white/30 hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FiDownload />
                Download selected ({selectedCount})
              </button>

              <button
                type="button"
                onClick={downloadLastExport}
                disabled={!downloadPayload || processing}
                className="flex min-w-[160px] items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-6 py-3 text-base font-semibold text-white/80 transition duration-300 hover:-translate-y-0.5 hover:border-white/30 hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FiDownload />
                Download last export
              </button>

              <button
                type="button"
                onClick={resetTool}
                className="flex min-w-[120px] items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-6 py-3 text-base font-semibold text-white/80 transition duration-300 hover:-translate-y-0.5 hover:border-white/30 hover:bg-white/15"
              >
                <FiRefreshCcw />
                Reset tool
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default PDFPageOrganizer;
