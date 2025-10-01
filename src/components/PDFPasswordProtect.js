import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiUpload,
  FiFile,
  FiX,
  FiLock,
  FiShield,
  FiSettings,
  FiDownload,
  FiAlertCircle,
  FiCheckCircle,
  FiRotateCw
} from 'react-icons/fi';
import { PDFDocument } from 'pdf-lib-plus-encrypt';

const cn = (...classes) => classes.filter(Boolean).join(' ');

const notificationStyles = {
  success: 'border-[rgba(255,107,53,0.3)] bg-[rgba(255,107,53,0.1)] text-brand-orange',
  error: 'border-[rgba(255,107,107,0.3)] bg-[rgba(255,107,107,0.1)] text-brand-error',
  info: 'border-[rgba(255,140,66,0.3)] bg-[rgba(255,140,66,0.1)] text-brand-orangeLight'
};

const defaultPassword = {
  user: '',
  confirm: '',
  owner: '',
  restrictCopying: true,
  allowPrinting: 'none'
};

const PDFPasswordProtect = () => {
  const [pdfFiles, setPdfFiles] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [processedFiles, setProcessedFiles] = useState([]);
  const [notification, setNotification] = useState(null);
  const [passwordOptions, setPasswordOptions] = useState(defaultPassword);

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
    (acceptedFiles) => {
      const pdfOnlyFiles = acceptedFiles.filter((file) => file.type === 'application/pdf');

      if (pdfOnlyFiles.length === 0) {
        showNotification('Please select only PDF files', 'error');
        return;
      }

      const descriptors = pdfOnlyFiles.map((file) => ({
        id: `${file.name}-${file.lastModified}-${Math.random().toString(16).slice(2)}`,
        file,
        name: file.name,
        size: (file.size / 1024 / 1024).toFixed(2) + ' MB'
      }));

      setPdfFiles((prev) => [...prev, ...descriptors]);
      showNotification(`Added ${descriptors.length} PDF file(s)`, 'success');
    },
    [showNotification]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    multiple: true
  });

  const removeFile = (id) => {
    setPdfFiles((prev) => prev.filter((pdf) => pdf.id !== id));
    showNotification('File removed', 'info');
  };

  const resetAll = () => {
    processedFiles.forEach((item) => URL.revokeObjectURL(item.url));
    setProcessedFiles([]);
    setPdfFiles([]);
    setPasswordOptions(defaultPassword);
    showNotification('Reset complete', 'info');
  };

  const passwordMismatch = useMemo(() => {
    if (!passwordOptions.user || !passwordOptions.confirm) return false;
    return passwordOptions.user !== passwordOptions.confirm;
  }, [passwordOptions]);

  const updatePassword = (patch) => {
    setPasswordOptions((prev) => ({ ...prev, ...patch }));
  };

  const processPdfs = async () => {
    if (pdfFiles.length === 0) {
      showNotification('Please add at least 1 PDF file to protect', 'error');
      return;
    }

    if (!passwordOptions.user) {
      showNotification('User password is required', 'error');
      return;
    }

    if (passwordMismatch) {
      showNotification('Password confirmation does not match', 'error');
      return;
    }

    setProcessing(true);
    processedFiles.forEach((item) => URL.revokeObjectURL(item.url));
    setProcessedFiles([]);

    try {
      const outputs = [];

      for (const descriptor of pdfFiles) {
        const pdfBytes = await descriptor.file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(pdfBytes);

        const printingPermission =
          passwordOptions.allowPrinting === 'none'
            ? false
            : passwordOptions.allowPrinting;

        await pdfDoc.encrypt({
          userPassword: passwordOptions.user,
          ownerPassword: passwordOptions.owner || passwordOptions.user,
          permissions: {
            copying: !passwordOptions.restrictCopying,
            printing: printingPermission
          },
          pdfVersion: '1.7'
        });

        const processedBytes = await pdfDoc.save();
        const blob = new Blob([processedBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        outputs.push({
          id: descriptor.id,
          name: descriptor.name.replace(/\.pdf$/i, '') + '-protected.pdf',
          url
        });
      }

      setProcessedFiles(outputs);
      showNotification(`Protected ${outputs.length} PDF file(s) successfully`, 'success');
    } catch (error) {
      console.error('Error protecting PDFs:', error);
      showNotification('Error protecting PDFs. Please try again.', 'error');
    } finally {
      setProcessing(false);
    }
  };

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
            <p className="text-sm text-white/50">Encrypt multiple documents with a password in one go</p>
          </div>
          <span className="rounded-full bg-white/10 px-4 py-1 text-xs font-medium text-white/50">Supports PDF only</span>
        </div>

        {pdfFiles.length > 0 && (
          <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-black/30 p-6">
            <h3 className="flex items-center gap-2 text-lg font-semibold text-white/80">
              <FiFile />
              Selected Files
            </h3>
            <div className="flex flex-col gap-3">
              {pdfFiles.map((pdf) => (
                <div
                  key={pdf.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-4 text-white/80"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-orange/10 text-brand-orange">
                      <FiFile />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-white/90">{pdf.name}</p>
                      <p className="text-xs text-white/50">{pdf.size}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-[rgba(255,107,107,0.3)] bg-[rgba(255,107,107,0.1)] text-brand-error transition duration-200 hover:scale-105 hover:border-brand-error hover:bg-[rgba(255,107,107,0.2)]"
                    onClick={() => removeFile(pdf.id)}
                    title="Remove file"
                  >
                    <FiX />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-black/30 p-6">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-white/80">
            <FiLock />
            Password Protection
          </h3>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium uppercase tracking-wide text-white/50">User Password</label>
              <input
                type="password"
                className="rounded-xl border border-white/20 bg-black/40 px-3 py-2 text-sm text-white/90 focus:border-brand-orange focus:outline-none focus:ring-4 focus:ring-[rgba(255,107,53,0.2)]"
                value={passwordOptions.user}
                onChange={(event) => updatePassword({ user: event.target.value })}
                placeholder="Required to open the document"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium uppercase tracking-wide text-white/50">Confirm Password</label>
              <input
                type="password"
                className={cn(
                  'rounded-xl border border-white/20 bg-black/40 px-3 py-2 text-sm text-white/90 focus:outline-none focus:ring-4 focus:ring-[rgba(255,107,53,0.2)]',
                  passwordMismatch && 'border-brand-error focus:border-brand-error focus:ring-[rgba(255,107,107,0.2)]'
                )}
                value={passwordOptions.confirm}
                onChange={(event) => updatePassword({ confirm: event.target.value })}
                placeholder="Re-enter password"
              />
              {passwordMismatch && <span className="text-xs text-brand-error">Passwords do not match</span>}
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium uppercase tracking-wide text-white/50">Owner Password (optional)</label>
              <input
                type="password"
                className="rounded-xl border border-white/20 bg-black/40 px-3 py-2 text-sm text-white/90 focus:border-brand-orange focus:outline-none focus:ring-4 focus:ring-[rgba(255,107,53,0.2)]"
                value={passwordOptions.owner}
                onChange={(event) => updatePassword({ owner: event.target.value })}
                placeholder="Defaults to user password if left blank"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-white/50">
                <FiShield /> Restrictions
              </label>
              <label className="flex items-center gap-2 text-sm text-white/70">
                <input
                  type="checkbox"
                  checked={passwordOptions.restrictCopying}
                  onChange={(event) => updatePassword({ restrictCopying: event.target.checked })}
                  className="h-4 w-4 rounded border border-white/40 bg-black/40"
                />
                Prevent copying & extraction
              </label>
              <label className="flex flex-col gap-1 text-sm text-white/70">
                <span className="text-xs text-white/50">Allow Printing</span>
                <select
                  value={passwordOptions.allowPrinting}
                  onChange={(event) => updatePassword({ allowPrinting: event.target.value })}
                  className="rounded-xl border border-white/20 bg-black/40 px-3 py-2 text-sm text-white/90 focus:border-brand-orange focus:outline-none focus:ring-4 focus:ring-[rgba(255,107,53,0.2)]"
                >
                  <option value="none">Not allowed</option>
                  <option value="lowResolution">Low resolution</option>
                  <option value="highResolution">High resolution</option>
                </select>
              </label>
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
                Protecting...
              </>
            ) : (
              <>
                <FiSettings />
                Apply Protection
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
              Protected Documents
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

export default PDFPasswordProtect;
