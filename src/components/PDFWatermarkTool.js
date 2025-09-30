import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiUpload,
  FiFile,
  FiX,
  FiType,
  FiDroplet,
  FiSettings,
  FiDownload,
  FiAlertCircle,
  FiCheckCircle,
  FiRotateCw,
  FiMapPin
} from 'react-icons/fi';
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib-plus-encrypt';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.js';

GlobalWorkerOptions.workerSrc = pdfjsWorker;

const cn = (...classes) => classes.filter(Boolean).join(' ');

const notificationStyles = {
  success: 'border-[rgba(255,107,53,0.3)] bg-[rgba(255,107,53,0.1)] text-brand-orange',
  error: 'border-[rgba(255,107,107,0.3)] bg-[rgba(255,107,107,0.1)] text-brand-error',
  info: 'border-[rgba(255,140,66,0.3)] bg-[rgba(255,140,66,0.1)] text-brand-orangeLight'
};

const defaultWatermark = {
  text: 'CONFIDENTIAL',
  fontSize: 48,
  opacity: 0.2,
  color: '#FF6B35',
  rotation: -30,
  positionX: 50,
  positionY: 50
};

const hexToRgb = (hex) => {
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

const createDescriptor = async (file) => {
  const arrayBuffer = await file.arrayBuffer();
  return {
    id: `${file.name}-${file.lastModified}-${Math.random().toString(16).slice(2)}`,
    file,
    name: file.name,
    sizeMb: (file.size / 1024 / 1024).toFixed(2) + ' MB',
    pdfBytes: new Uint8Array(arrayBuffer)
  };
};

const WatermarkPreview = ({ descriptor, options }) => {
  const [meta, setMeta] = useState({ width: 0, height: 0, scale: 1 });
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!descriptor?.pdfBytes) {
      return undefined;
    }

    let cancelled = false;
    let loadingTask;
    setMeta({ width: 0, height: 0, scale: 1 });

    const renderPreview = async () => {
      try {
        loadingTask = getDocument({ data: descriptor.pdfBytes, disableWorker: true });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);
        const baseViewport = page.getViewport({ scale: 1 });
        const maxWidth = 520;
        const scale = Math.min(maxWidth / baseViewport.width, 1.5);
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas || cancelled) {
          await pdf.destroy();
          return;
        }
        const context = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        context.clearRect(0, 0, canvas.width, canvas.height);
        const renderTask = page.render({ canvasContext: context, viewport });
        await renderTask.promise;
        if (!cancelled) {
          setMeta({ width: viewport.width, height: viewport.height, scale });
        }
        await pdf.destroy();
      } catch (error) {
        console.error('Error rendering preview:', error);
      }
    };

    renderPreview();

    return () => {
      cancelled = true;
      if (loadingTask) {
        loadingTask.destroy();
      }
    };
  }, [descriptor]);

  const overlayStyle = useMemo(() => ({
    left: `${options.positionX}%`,
    top: `${options.positionY}%`,
    transform: `translate(-50%, -50%) rotate(${options.rotation}deg)`
  }), [options.positionX, options.positionY, options.rotation]);

  const textStyle = useMemo(() => ({
    fontSize: `${Math.max(options.fontSize * meta.scale, 8)}px`,
    color: options.color,
    opacity: options.opacity,
    fontWeight: 700,
    letterSpacing: '0.2em',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap'
  }), [options.fontSize, meta.scale, options.color, options.opacity]);

  if (!descriptor) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
      <div className="mb-3 flex items-center justify-between text-sm text-white/60">
        <div className="flex items-center gap-2">
          <FiFile />
          <span>{descriptor.name}</span>
        </div>
        <span>{descriptor.sizeMb}</span>
      </div>
      <div className="relative mx-auto inline-flex rounded-xl bg-black/60 p-3 shadow-merger-card" style={{ width: meta.width || 'auto' }}>
        <canvas ref={canvasRef} className="max-w-full rounded-lg" />
        {meta.width > 0 && (
          <div className="pointer-events-none absolute inset-3">
            <div className="absolute" style={overlayStyle}>
              <span className="block select-none" style={textStyle}>
                {options.text || ' '}
              </span>
            </div>
          </div>
        )}
      </div>
      <p className="mt-3 text-xs text-white/40">
        Preview shows the first page with the current watermark styling. Final export applies to all pages.
      </p>
    </div>
  );
};

const PDFWatermarkTool = () => {
  const [pdfFiles, setPdfFiles] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [processedFiles, setProcessedFiles] = useState([]);
  const [notification, setNotification] = useState(null);
  const [watermarkOptions, setWatermarkOptions] = useState(defaultWatermark);
  const [activePreviewId, setActivePreviewId] = useState(null);

  const showNotification = useCallback((message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  useEffect(() => {
    return () => {
      processedFiles.forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, [processedFiles]);

  const onDrop = useCallback(
    async (acceptedFiles) => {
      const pdfOnlyFiles = acceptedFiles.filter((file) => file.type === 'application/pdf');

      if (pdfOnlyFiles.length === 0) {
        showNotification('Please select only PDF files', 'error');
        return;
      }

      try {
        const descriptors = await Promise.all(pdfOnlyFiles.map(createDescriptor));
        setPdfFiles((prev) => {
          const updated = [...prev, ...descriptors];
          if (!activePreviewId && updated.length > 0) {
            setActivePreviewId(updated[0].id);
          }
          return updated;
        });
        if (!activePreviewId && descriptors.length > 0) {
          setActivePreviewId(descriptors[0].id);
        }
        showNotification(`Added ${descriptors.length} PDF file(s)`, 'success');
      } catch (error) {
        console.error('Error loading PDF for preview:', error);
        showNotification('Could not read one of the PDFs. Please try another file.', 'error');
      }
    },
    [activePreviewId, showNotification]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    multiple: true
  });

  const removeFile = (id) => {
    setPdfFiles((prev) => {
      const filtered = prev.filter((pdf) => pdf.id !== id);
      if (activePreviewId === id) {
        setActivePreviewId(filtered.length ? filtered[0].id : null);
      }
      return filtered;
    });
    showNotification('File removed', 'info');
  };

  const resetAll = () => {
    processedFiles.forEach((item) => URL.revokeObjectURL(item.url));
    setProcessedFiles([]);
    setPdfFiles([]);
    setActivePreviewId(null);
    setWatermarkOptions(defaultWatermark);
    showNotification('Reset complete', 'info');
  };

  const activeDescriptor = useMemo(() => pdfFiles.find((pdf) => pdf.id === activePreviewId) || null, [pdfFiles, activePreviewId]);

  const updateWatermark = (patch) => {
    setWatermarkOptions((prev) => ({ ...prev, ...patch }));
  };

  const processPdfs = async () => {
    if (pdfFiles.length === 0) {
      showNotification('Please add at least 1 PDF file to watermark', 'error');
      return;
    }

    if (!watermarkOptions.text.trim()) {
      showNotification('Watermark text cannot be empty', 'error');
      return;
    }

    setProcessing(true);
    processedFiles.forEach((item) => URL.revokeObjectURL(item.url));
    setProcessedFiles([]);

    try {
      const outputs = [];
      const { text, fontSize, opacity, color, rotation, positionX, positionY } = watermarkOptions;
      const { r, g, b } = hexToRgb(color || '#FF6B35');

      for (const descriptor of pdfFiles) {
        const pdfDoc = await PDFDocument.load(descriptor.pdfBytes);
        const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const pages = pdfDoc.getPages();

        pages.forEach((page) => {
          const { width, height } = page.getSize();
          const textWidth = font.widthOfTextAtSize(text, fontSize);
          const textHeight = font.heightAtSize(fontSize);

          const centerX = (positionX / 100) * width;
          const centerY = height - (positionY / 100) * height;
          const x = Math.max(centerX - textWidth / 2, -width);
          const y = Math.max(centerY - textHeight / 2, -height);

          page.drawText(text, {
            x,
            y,
            size: fontSize,
            font,
            color: rgb(r, g, b),
            opacity,
            rotate: degrees(rotation)
          });
        });

        const processedBytes = await pdfDoc.save();
        const blob = new Blob([processedBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        outputs.push({
          id: descriptor.id,
          name: descriptor.name.replace(/\.pdf$/i, '') + '-watermarked.pdf',
          url
        });
      }

      setProcessedFiles(outputs);
      showNotification(`Watermarked ${outputs.length} PDF file(s) successfully`, 'success');
    } catch (error) {
      console.error('Error watermarking PDFs:', error);
      showNotification('Error applying watermark. Please try again.', 'error');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="relative mx-auto w-full max-w-[900px]">
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
        className="relative flex flex-col gap-6 rounded-[28px] border border-[rgba(255,107,53,0.2)] bg-white/5 p-8 shadow-merger-card backdrop-blur-xl"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div
          {...getRootProps()}
          className={cn(
            'relative flex cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-white/20 bg-black/30 px-8 py-12 text-center transition duration-300 hover:border-brand-orange/40 hover:bg-black/20',
            isDragActive && 'border-brand-orange bg-black/10'
          )}
        >
          <input {...getInputProps()} />
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-orange/10 text-3xl text-brand-orange">
            <FiUpload />
          </span>
          <div className="space-y-1">
            <p className="text-lg font-semibold text-white/90">Drop your PDF files here</p>
            <p className="text-sm text-white/50">Upload documents to preview and apply a watermark</p>
          </div>
          <span className="rounded-full bg-white/10 px-4 py-1 text-xs font-medium text-white/50">Supports PDF only</span>
        </div>

        {pdfFiles.length > 0 && (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[280px_1fr]">
            <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/30 p-5">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-white/80">
                <FiFile />
                Selected Files
              </h3>
              <div className="flex max-h-[260px] flex-col gap-3 overflow-y-auto pr-1">
                {pdfFiles.map((pdf) => (
                  <button
                    key={pdf.id}
                    type="button"
                    className={cn(
                      'flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition duration-200',
                      activePreviewId === pdf.id
                        ? 'border-brand-orange/40 bg-brand-orange/10 text-white'
                        : 'border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:bg-white/10'
                    )}
                    onClick={() => setActivePreviewId(pdf.id)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-orange/10 text-brand-orange">
                        <FiDroplet />
                      </span>
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-white/90">{pdf.name}</span>
                        <span className="text-xs text-white/50">{pdf.sizeMb}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        removeFile(pdf.id);
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-md border border-[rgba(255,107,107,0.3)] bg-[rgba(255,107,107,0.1)] text-brand-error transition duration-200 hover:scale-105 hover:border-brand-error hover:bg-[rgba(255,107,107,0.2)]"
                      title="Remove file"
                    >
                      <FiX />
                    </button>
                  </button>
                ))}
              </div>
            </div>

            {activeDescriptor ? (
              <WatermarkPreview descriptor={activeDescriptor} options={watermarkOptions} />
            ) : (
              <div className="flex min-h-[260px] items-center justify-center rounded-2xl border border-dashed border-white/10 bg-black/30 p-6 text-sm text-white/40">
                Select a file to see the live watermark preview.
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-black/30 p-6">
            <h3 className="flex items-center gap-2 text-lg font-semibold text-white/80">
              <FiType />
              Watermark Text
            </h3>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium uppercase tracking-wide text-white/50">Text</label>
                <input
                  type="text"
                  className="rounded-xl border border-white/20 bg-black/40 px-3 py-2 text-sm text-white/90 focus:border-brand-orange focus:outline-none focus:ring-4 focus:ring-[rgba(255,107,53,0.2)]"
                  value={watermarkOptions.text}
                  onChange={(event) => updateWatermark({ text: event.target.value })}
                  placeholder="Enter watermark text"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-white/50">
                  Font Size
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/60">{watermarkOptions.fontSize}px</span>
                </label>
                <input
                  type="range"
                  min="18"
                  max="120"
                  step="2"
                  value={watermarkOptions.fontSize}
                  onChange={(event) => updateWatermark({ fontSize: Number(event.target.value) })}
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-white/50">
                  Opacity
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/60">{Math.round(watermarkOptions.opacity * 100)}%</span>
                </label>
                <input
                  type="range"
                  min="0.05"
                  max="0.8"
                  step="0.05"
                  value={watermarkOptions.opacity}
                  onChange={(event) => updateWatermark({ opacity: Number(event.target.value) })}
                />
              </div>

              <div className="flex items-center justify-between gap-3">
                <label className="text-xs font-medium uppercase tracking-wide text-white/50">Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={watermarkOptions.color}
                    onChange={(event) => updateWatermark({ color: event.target.value })}
                    className="h-9 w-16 cursor-pointer rounded-lg border border-white/10 bg-transparent"
                  />
                  <span className="text-xs text-white/50">{watermarkOptions.color.toUpperCase()}</span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-white/50">
                  Rotation
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/60">{watermarkOptions.rotation}�</span>
                </label>
                <input
                  type="range"
                  min="-90"
                  max="90"
                  step="5"
                  value={watermarkOptions.rotation}
                  onChange={(event) => updateWatermark({ rotation: Number(event.target.value) })}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-black/30 p-6">
            <h3 className="flex items-center gap-2 text-lg font-semibold text-white/80">
              <FiMapPin />
              Watermark Position
            </h3>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <label className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-white/50">
                  Horizontal Position
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/60">{watermarkOptions.positionX}%</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={watermarkOptions.positionX}
                  onChange={(event) => updateWatermark({ positionX: Number(event.target.value) })}
                />
                <div className="flex justify-between text-[10px] uppercase tracking-wide text-white/40">
                  <span>Left</span>
                  <span>Center</span>
                  <span>Right</span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-white/50">
                  Vertical Position
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/60">{watermarkOptions.positionY}%</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={watermarkOptions.positionY}
                  onChange={(event) => updateWatermark({ positionY: Number(event.target.value) })}
                />
                <div className="flex justify-between text-[10px] uppercase tracking-wide text-white/40">
                  <span>Top</span>
                  <span>Center</span>
                  <span>Bottom</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          <button
            type="button"
            className="group relative flex min-w-[180px] flex-1 items-center justify-center gap-2 overflow-hidden rounded-xl border-none bg-gradient-orange px-7 py-3 text-base font-semibold text-white shadow-action transition duration-300 hover:-translate-y-0.5 hover:shadow-action-hover disabled:cursor-not-allowed disabled:opacity-60"
            onClick={processPdfs}
            disabled={processing || pdfFiles.length === 0}
          >
            <span className="pointer-events-none absolute left-1/2 top-1/2 h-0 w-0 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/30 opacity-0 transition-all duration-500 group-hover:h-[260px] group-hover:w-[260px] group-hover:opacity-100" />
            {processing ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></span>
                Applying...
              </>
            ) : (
              <>
                <FiSettings />
                Apply Watermark
              </>
            )}
          </button>

          <button
            type="button"
            className="flex min-w-[120px] items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-6 py-3 text-base font-semibold text-white/80 transition duration-300 hover:-translate-y-0.5 hover:border-white/30 hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={resetAll}
            disabled={processing}
          >
            <FiRotateCw />
            Reset
          </button>
        </div>

        {processedFiles.length > 0 && (
          <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-black/30 p-6">
            <h3 className="flex items-center gap-2 text-lg font-semibold text-white/80">
              <FiDownload />
              Watermarked Documents
            </h3>
            <div className="flex flex-col gap-3">
              {processedFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="flex items-center gap-3 text-white/80">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-orange/10 text-brand-orange">
                      <FiFile />
                    </span>
                    <p className="text-sm font-semibold text-white/90">{file.name}</p>
                  </div>
                  <a
                    href={file.url}
                    download={file.name}
                    className="flex items-center gap-2 rounded-xl bg-gradient-success px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_20px_rgba(76,175,80,0.3)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_6px_30px_rgba(76,175,80,0.4)]"
                  >
                    <FiDownload />
                    Download
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default PDFWatermarkTool;







