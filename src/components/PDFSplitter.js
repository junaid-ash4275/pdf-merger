import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { PDFDocument } from 'pdf-lib';
import {
  FiAlertCircle,
  FiCheckCircle,
  FiDownload,
  FiGrid,
  FiRotateCcw,
  FiUpload
} from 'react-icons/fi';

import parsePageSelection from './parsePageSelection';

const cn = (...classes) => classes.filter(Boolean).join(' ');

const notificationStyles = {
  success: 'border-[rgba(255,107,53,0.3)] bg-[rgba(255,107,53,0.1)] text-brand-orange',
  error: 'border-[rgba(255,107,107,0.3)] bg-[rgba(255,107,107,0.1)] text-brand-error',
  info: 'border-[rgba(255,140,66,0.3)] bg-[rgba(255,140,66,0.1)] text-brand-orangeLight'
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

const PDFSplitter = () => {
  const [notification, setNotification] = useState(null);
  const [loading, setLoading] = useState(false);
  const [splitting, setSplitting] = useState(false);
  const [pdfBytes, setPdfBytes] = useState(null);
  const [pdfInfo, setPdfInfo] = useState(null);
  const [rangesInput, setRangesInput] = useState('');
  const [rangeErrors, setRangeErrors] = useState([]);
  const [splitResults, setSplitResults] = useState([]);

  const showNotification = useCallback((message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  const revokeResults = useCallback((results) => {
    results.forEach((result) => {
      if (result?.url) {
        URL.revokeObjectURL(result.url);
      }
    });
  }, []);

  useEffect(() => () => revokeResults(splitResults), [revokeResults, splitResults]);

  const resetSplitResults = useCallback(() => {
    setSplitResults((previous) => {
      if (previous.length > 0) {
        revokeResults(previous);
      }
      return [];
    });
  }, [revokeResults]);

  const onDrop = useCallback(async (acceptedFiles) => {
    const pdfFile = acceptedFiles.find((file) => {
      if (file.type === 'application/pdf') {
        return true;
      }

      const lowerCaseName = file.name?.toLowerCase();
      return Boolean(lowerCaseName && lowerCaseName.endsWith('.pdf'));
    });

    if (!pdfFile) {
      showNotification('Please choose a PDF file.', 'error');
      return;
    }

    setLoading(true);
    setRangeErrors([]);
    resetSplitResults();

    try {
      const arrayBuffer = await pdfFile.arrayBuffer();
      const typedArray = ensureUint8Array(arrayBuffer);
      const pdfDoc = await PDFDocument.load(typedArray);
      const { base, extension } = extractNameParts(pdfFile.name);
      const pageCount = pdfDoc.getPageCount();

      setPdfBytes(typedArray);
      setPdfInfo({
        name: pdfFile.name,
        baseName: base,
        extension: extension || '.pdf',
        totalPages: pageCount,
        sizeLabel: `${(pdfFile.size / 1024 / 1024).toFixed(2)} MB`
      });

      if (pageCount > 1) {
        const mid = Math.ceil(pageCount / 2);
        setRangesInput(`1-${mid}\n${mid + 1}-${pageCount}`);
      } else {
        setRangesInput('1');
      }

      showNotification(`Loaded ${pageCount} page(s) from ${pdfFile.name}`, 'success');
    } catch (error) {
      console.error('Error loading PDF for splitting:', error);
      showNotification('Could not read this PDF. Please try another file.', 'error');
      setPdfBytes(null);
      setPdfInfo(null);
      setRangesInput('');
    } finally {
      setLoading(false);
    }
  }, [resetSplitResults, showNotification]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    multiple: false
  });

  const handleSplit = useCallback(async () => {
    if (!pdfBytes || !pdfInfo) {
      showNotification('Upload a PDF to split first.', 'info');
      return;
    }

    const trimmedLines = rangesInput
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    if (trimmedLines.length === 0) {
      showNotification('Add at least one page range to split.', 'info');
      return;
    }

    setRangeErrors([]);
    resetSplitResults();
    setSplitting(true);

    try {
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const pageUsage = new Set();
      const pendingResults = [];
      const localErrors = [];

      for (let index = 0; index < trimmedLines.length; index += 1) {
        const line = trimmedLines[index];
        const { pages, error } = parsePageSelection(line, pdfDoc.getPageCount());

        if (error) {
          localErrors.push({ line: index + 1, message: error });
          continue;
        }

        const overlaps = pages.filter((page) => pageUsage.has(page));
        if (overlaps.length > 0) {
          localErrors.push({
            line: index + 1,
            message: `Range overlaps with previously defined pages (page ${overlaps[0] + 1}).`
          });
          continue;
        }

        pages.forEach((page) => pageUsage.add(page));

        const newDoc = await PDFDocument.create();
        const copiedPages = await newDoc.copyPages(pdfDoc, pages);
        copiedPages.forEach((page) => newDoc.addPage(page));

        const newBytes = await newDoc.save();
        const blob = new Blob([newBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);

        pendingResults.push({
          url,
          fileName: `${pdfInfo.baseName || 'document'}-part-${index + 1}${pdfInfo.extension || '.pdf'}`,
          pageCount: pages.length
        });
      }

      if (localErrors.length > 0) {
        revokeResults(pendingResults);
        setRangeErrors(localErrors);
        showNotification('Fix the highlighted range issues and try again.', 'error');
        return;
      }

      if (pendingResults.length === 0) {
        showNotification('No valid ranges to split.', 'info');
        return;
      }

      setSplitResults((previous) => {
        if (previous.length > 0) {
          revokeResults(previous);
        }
        return pendingResults;
      });
      showNotification(`Created ${pendingResults.length} split file(s)!`, 'success');
    } catch (error) {
      console.error('Error splitting PDF:', error);
      showNotification('Something went wrong while splitting. Please try again.', 'error');
    } finally {
      setSplitting(false);
    }
  }, [pdfBytes, pdfInfo, rangesInput, resetSplitResults, revokeResults, showNotification]);

  const downloadPart = useCallback(
    (url, fileName, { notify = true } = {}) => {
      if (!url) {
        return;
      }

      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      if (notify) {
        showNotification('Download started!', 'success');
      }
    },
    [showNotification]
  );

  const downloadAllParts = useCallback(() => {
    if (!splitResults.length) {
      showNotification('No files to download yet.', 'info');
      return;
    }

    splitResults.forEach((result) => {
      downloadPart(result.url, result.fileName, { notify: false });
    });

    showNotification('All downloads started!', 'success');
  }, [downloadPart, showNotification, splitResults]);

  const resetTool = useCallback(() => {
    setNotification(null);
    setLoading(false);
    setSplitting(false);
    setPdfBytes(null);
    setPdfInfo(null);
    setRangesInput('');
    setRangeErrors([]);
    resetSplitResults();
  }, [resetSplitResults]);

  const hasPdfLoaded = useMemo(() => Boolean(pdfInfo), [pdfInfo]);

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
          <input {...getInputProps()} disabled={loading || splitting} />
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
                {isDragActive ? 'Drop your PDF file to define splits...' : 'Drag & drop a PDF here, or click to select'}
              </p>
              <span className="text-sm text-white/50">We will split the document into separate downloads based on the ranges you provide.</span>
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
                <span className="text-sm">Preparing your document...</span>
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
                <p className="text-sm text-white/50">{pdfInfo.totalPages} page(s) • {pdfInfo.sizeLabel}</p>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-white/70">
                <FiGrid className="text-brand-orange" />
                <span>Define ranges to generate separate PDFs</span>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
              <div className="flex flex-col gap-3">
                <label htmlFor="split-ranges" className="flex items-center justify-between text-sm font-medium text-brand-orange">
                  Page ranges (one per line)
                  <span className="text-xs text-white/50">Example: 1-3 or 5,7</span>
                </label>
                <textarea
                  id="split-ranges"
                  className="min-h-[160px] rounded-2xl border border-white/15 bg-black/40 p-4 text-sm text-white/90 shadow-inner transition focus:border-brand-orange focus:outline-none focus:ring-4 focus:ring-[rgba(255,107,53,0.2)] placeholder:text-white/30"
                  placeholder={'1-3\n4-6\n7'}
                  value={rangesInput}
                  onChange={(event) => setRangesInput(event.target.value)}
                  disabled={splitting}
                ></textarea>

                {rangeErrors.length > 0 && (
                  <div className="rounded-xl border border-[rgba(255,107,107,0.3)] bg-[rgba(255,107,107,0.08)] p-4 text-sm text-brand-error">
                    <p className="font-semibold">Fix these issues:</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-brand-error/90">
                      {rangeErrors.map((issue) => (
                        <li key={`${issue.line}-${issue.message}`}>
                          Line {issue.line}: {issue.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-white/70">
                <h4 className="text-base font-semibold text-white/85">Tips</h4>
                <ul className="flex flex-col gap-2 text-xs leading-relaxed text-white/60">
                  <li>• Use `*` to include all pages in one range.</li>
                  <li>• Ranges cannot overlap to avoid duplicate pages.</li>
                  <li>• Combine single pages with commas, e.g. `1,3,5`.</li>
                  <li>• Leave blank lines between ranges to ignore them.</li>
                </ul>
                <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-xs text-white/60">
                  <p className="font-semibold text-white/80">Document summary</p>
                  <p>Total pages: {pdfInfo.totalPages}</p>
                  <p>Current splits: {rangesInput.split('\n').filter((line) => line.trim()).length}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              <button
                type="button"
                onClick={handleSplit}
                disabled={splitting}
                className="group/button relative flex min-w-[160px] flex-1 items-center justify-center gap-2 overflow-hidden rounded-xl border-none bg-gradient-orange px-7 py-3 text-base font-semibold text-white shadow-action transition duration-300 hover:-translate-y-0.5 hover:shadow-action-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="pointer-events-none absolute left-1/2 top-1/2 h-0 w-0 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/30 opacity-0 transition-all duration-500 group-hover/button:h-[260px] group-hover/button:w-[260px] group-hover/button:opacity-100"></span>
                {splitting ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></span>
                    Splitting...
                  </>
                ) : (
                  <>
                    <FiGrid />
                    Split Document
                  </>
                )}
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

            {splitResults.length > 0 && (
              <motion.div
                className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/80"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h4 className="text-lg font-semibold text-white/90">Split results</h4>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-white/50">
                    <span>{splitResults.length} file(s) ready</span>
                    <button
                      type="button"
                      onClick={downloadAllParts}
                      disabled={splitting}
                      className="flex items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold text-white/80 transition duration-300 hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <FiDownload className="text-base" />
                      Download All
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {splitResults.map((result) => (
                    <div
                      key={result.fileName}
                      className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-xs text-white/70"
                    >
                      <div className="flex flex-col">
                        <span className="font-medium text-white/85">{result.fileName}
                        </span>
                        <span>{result.pageCount} page(s)</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => downloadPart(result.url, result.fileName)}
                        className="flex items-center gap-2 rounded-lg bg-gradient-success px-4 py-2 text-xs font-semibold text-white shadow-[0_4px_16px_rgba(76,175,80,0.25)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_6px_24px_rgba(76,175,80,0.35)]"
                      >
                        <FiDownload />
                        Download
                      </button>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default PDFSplitter;
