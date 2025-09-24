import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { PDFDocument } from 'pdf-lib';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiUpload, 
  FiFile, 
  FiX, 
  FiDownload, 
  FiMove, 
  FiCheckCircle,
  FiAlertCircle,
  FiList
} from 'react-icons/fi';
import parsePageSelection from './parsePageSelection';

const cn = (...classes) => classes.filter(Boolean).join(' ');

const notificationStyles = {
  success: 'border-[rgba(255,107,53,0.3)] bg-[rgba(255,107,53,0.1)] text-brand-orange',
  error: 'border-[rgba(255,107,107,0.3)] bg-[rgba(255,107,107,0.1)] text-brand-error',
  info: 'border-[rgba(255,140,66,0.3)] bg-[rgba(255,140,66,0.1)] text-brand-orangeLight',
};

const PDFMerger = () => {
  const [pdfFiles, setPdfFiles] = useState([]);
  const [merging, setMerging] = useState(false);
  const [mergedPdf, setMergedPdf] = useState(null);
  const [notification, setNotification] = useState(null);

  const showNotification = useCallback((message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  const onDrop = useCallback(async (acceptedFiles) => {
    const pdfOnlyFiles = acceptedFiles.filter(file => file.type === 'application/pdf');

    if (pdfOnlyFiles.length === 0) {
      showNotification('Please select only PDF files', 'error');
      return;
    }

    const processedFiles = await Promise.all(
      pdfOnlyFiles.map(async (file) => {
        try {
          const arrayBuffer = await file.arrayBuffer();
          const pdfDoc = await PDFDocument.load(arrayBuffer);
          const totalPages = pdfDoc.getPageCount();
          const defaultSelection = totalPages === 1 ? '1' : `1-${totalPages}`;

          return {
            id: `pdf-${Date.now()}-${Math.random()}`,
            file,
            name: file.name,
            size: (file.size / 1024 / 1024).toFixed(2) + ' MB',
            totalPages,
            pageSelection: defaultSelection,
            pageSelectionError: null
          };
        } catch (error) {
          console.error('Error reading PDF:', error);
          showNotification(`Could not read ${file.name}. Please try another file.`, 'error');
          return null;
        }
      })
    );

    const newPdfFiles = processedFiles.filter(Boolean);

    if (newPdfFiles.length > 0) {
      setPdfFiles(prev => [...prev, ...newPdfFiles]);
      showNotification(`Added ${newPdfFiles.length} PDF file(s)`, 'success');
    }
  }, [showNotification]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    multiple: true
  });

  const removeFile = (id) => {
    setPdfFiles(prev => prev.filter(pdf => pdf.id !== id));
    showNotification('File removed', 'info');
  };

  const handlePageSelectionChange = (id, value) => {
    setPdfFiles(prev => prev.map(pdf => {
      if (pdf.id !== id) {
        return pdf;
      }

      const { error } = parsePageSelection(value, pdf.totalPages);

      return {
        ...pdf,
        pageSelection: value,
        pageSelectionError: error
      };
    }));
  };

  const onDragEnd = (result) => {
    if (!result.destination) return;

    const items = Array.from(pdfFiles);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setPdfFiles(items);
  };

  // const getDraggableItemStyle = (style, snapshot) => {
  //   const baseStyle = style ? { ...style } : {};

  //   baseStyle.opacity = snapshot.isDragging ? 0.8 : 1;

  //   if (snapshot.isDragging) {
  //     baseStyle.cursor = 'grabbing';
  //   }

  //   if (!snapshot.isDragging) {
  //     baseStyle.cursor = 'grab';
  //   }

  //   if (snapshot.isDragging && style?.transform) {
  //     baseStyle.transform = `${style.transform} rotate(2deg)`;
  //   }

  //   return baseStyle;
  // };

  const mergePDFs = async () => {
    if (pdfFiles.length < 2) {
      showNotification('Please add at least 2 PDF files to merge', 'error');
      return;
    }

    setMerging(true);
    try {
      const mergedDoc = await PDFDocument.create();

      for (const pdfFile of pdfFiles) {
        const pdfBytes = await pdfFile.file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const { pages: pageIndices, error } = parsePageSelection(pdfFile.pageSelection, pdfDoc.getPageCount());

        if (error) {
          showNotification(`Fix page selection for ${pdfFile.name}: ${error}`, 'error');
          setMerging(false);
          return;
        }

        const indicesToCopy = pageIndices.length > 0 ? pageIndices : pdfDoc.getPageIndices();
        const pages = await mergedDoc.copyPages(pdfDoc, indicesToCopy);
        
        pages.forEach((page) => {
          mergedDoc.addPage(page);
        });
      }

      const mergedPdfBytes = await mergedDoc.save();
      const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      setMergedPdf(url);
      showNotification('PDFs merged successfully!', 'success');
    } catch (error) {
      console.error('Error merging PDFs:', error);
      showNotification('Error merging PDFs. Please try again.', 'error');
    } finally {
      setMerging(false);
    }
  };

  const downloadMergedPdf = () => {
    if (mergedPdf) {
      const link = document.createElement('a');
      link.href = mergedPdf;
      link.download = `merged-pdf-${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showNotification('Download started!', 'success');
    }
  };

  const resetMerger = () => {
    setPdfFiles([]);
    setMergedPdf(null);
    showNotification('Reset complete', 'info');
  };

  return (
    <div className="relative mx-auto w-full max-w-[800px]">
      {/* Notification */}
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

        {/* Dropzone */}
        <div 
          {...getRootProps()} 
          className={cn(
            'group/drop relative overflow-hidden rounded-2xl border-2 border-dashed border-[rgba(255,107,53,0.4)] bg-[rgba(255,107,53,0.05)] px-8 py-12 text-center transition-all duration-300 hover:border-[rgba(255,107,53,0.6)] hover:bg-[rgba(255,107,53,0.08)] hover:shadow-dropzone cursor-pointer',
            isDragActive && 'border-[rgba(255,107,53,0.8)] bg-[rgba(255,107,53,0.1)] shadow-dropzone'
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
            <p className="text-[1.1rem] text-white/80">
              {isDragActive 
                ? 'Drop your PDF files here...' 
                : 'Drag & drop PDF files here, or click to select'}
            </p>
            <button className="pointer-events-auto rounded-full bg-gradient-orange px-8 py-3 text-base font-semibold text-white shadow-action transition duration-300 hover:-translate-y-0.5 hover:bg-gradient-orange-strong hover:shadow-action-hover">
              Select PDF Files
            </button>
          </div>
        </div>

        {/* File List */}
        {pdfFiles.length > 0 && (
          <motion.div 
            className="mt-8"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            transition={{ duration: 0.3 }}
          >
            <div className="mb-4 flex items-center justify-between px-2">
              <h3 className="text-lg font-semibold text-brand-orange">PDF Files ({pdfFiles.length})</h3>
              <p className="flex items-center gap-2 text-sm text-white/50">
                <FiMove /> Hover & drag to reorder
              </p>
            </div>

            <DragDropContext onDragEnd={onDragEnd}>
              <Droppable droppableId="pdf-list">
                {(provided, snapshot) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className={cn(
                      'flex max-h-[400px] flex-col gap-3 overflow-y-auto rounded-xl p-2 transition-colors duration-300',
                      snapshot.isDraggingOver && 'bg-[rgba(255,107,53,0.05)]'
                    )}
                  >
                    {pdfFiles.map((pdf, index) => (
                      <Draggable key={pdf.id} draggableId={pdf.id} index={index}>
                        {(provided, snapshot) => {
                          const baseStyle = provided.draggableProps.style || {};
                          const baseTransform = baseStyle.transform;
                          const dragStyle = {
                            ...baseStyle,
                            opacity: snapshot.isDragging ? 0.8 : 1,
                            transform: snapshot.isDragging && baseTransform
                              ? `${baseTransform} rotate(2deg)`
                              : baseTransform,
                            cursor: snapshot.isDragging ? 'grabbing' : 'grab'
                          };

                          return (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={cn(
                                'group flex w-full cursor-grab items-start gap-4 rounded-2xl border border-[rgba(255,107,53,0.2)] bg-white/5 p-4 transition-all duration-300 hover:-translate-x-1 hover:border-[rgba(255,107,53,0.4)] hover:bg-white/10 hover:shadow-merger-card',
                                snapshot.isDragging && 'cursor-grabbing bg-[rgba(255,107,53,0.1)] shadow-merger-card'
                              )}
                              style={dragStyle}
                              title="Drag to reorder"
                            >
                              <div className="flex w-full items-stretch gap-4">
                                <FiFile className="mt-1 text-2xl text-brand-orange drop-shadow-icon" />
                                <div className="flex flex-1 flex-col overflow-hidden">
                                  <div className="flex flex-col gap-2">
                                    <span className="truncate font-medium text-white/90">{pdf.name}</span>
                                    <span className="text-sm text-white/50">{pdf.size}</span>
                                    {pdf.totalPages && (
                                      <span className="text-sm text-white/50">Total pages: {pdf.totalPages}</span>
                                    )}
                                  </div>
                                  <div className="mt-3 flex flex-1 flex-col gap-2 rounded-xl border border-[rgba(255,107,53,0.15)] bg-white/5 p-3">
                                    <label htmlFor={`page-selection-${pdf.id}`} className="flex items-center gap-2 text-sm font-medium text-brand-orange">
                                      <FiList /> Pages to include
                                    </label>
                                    <input
                                      id={`page-selection-${pdf.id}`}
                                      type="text"
                                      className={cn(
                                        'rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-sm text-white/90 transition focus:border-brand-orange focus:outline-none focus:ring-4 focus:ring-[rgba(255,107,53,0.2)] placeholder:text-white/30',
                                        pdf.pageSelectionError && 'border-brand-error focus:border-brand-error focus:ring-[rgba(255,107,107,0.2)]'
                                      )}
                                      value={pdf.pageSelection}
                                      onChange={(event) => handlePageSelectionChange(pdf.id, event.target.value)}
                                      placeholder={`1-${pdf.totalPages}`}
                                    />
                                    <p className="text-xs text-white/40">Use formats like 1-3,5,7 or * for all pages.</p>
                                    <div className="mt-auto">
                                      {pdf.pageSelectionError ? (
                                        <p className="text-xs text-brand-error">{pdf.pageSelectionError}</p>
                                      ) : (
                                        <p className="text-xs text-white/60">
                                          {parsePageSelection(pdf.pageSelection, pdf.totalPages).pages.length} page(s) selected
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div className="flex flex-shrink-0 items-center gap-3">
                                <div className="pointer-events-none flex h-7 w-7 items-center justify-center rounded-md bg-white/5 text-white/40 transition duration-300 group-hover:bg-[rgba(255,107,53,0.12)] group-hover:text-brand-orange">
                                  <FiMove className="text-base" />
                                </div>
                                <button
                                  type="button"
                                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-[rgba(255,107,107,0.3)] bg-[rgba(255,107,107,0.1)] text-brand-error transition duration-300 hover:scale-110 hover:border-brand-error hover:bg-[rgba(255,107,107,0.2)]"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    removeFile(pdf.id);
                                  }}
                                  title="Remove file"
                                >
                                  <FiX />
                                </button>
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

            {/* Action Buttons */}
            <div className="mt-6 flex flex-wrap gap-4">
              <button
                className="group/button relative flex min-w-[150px] flex-1 items-center justify-center gap-2 overflow-hidden rounded-xl border-none bg-gradient-orange px-7 py-3 text-base font-semibold text-white shadow-action transition duration-300 hover:-translate-y-0.5 hover:shadow-action-hover disabled:cursor-not-allowed disabled:opacity-50"
                onClick={mergePDFs}
                disabled={merging || pdfFiles.length < 2}
              >
                <span className="pointer-events-none absolute left-1/2 top-1/2 h-0 w-0 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/30 opacity-0 transition-all duration-500 group-hover/button:h-[300px] group-hover/button:w-[300px] group-hover/button:opacity-100"></span>
                {merging ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></span>
                    Merging...
                  </>
                ) : (
                  <>
                    <FiCheckCircle />
                    Merge PDFs
                  </>
                )}
              </button>

              {mergedPdf && (
                <motion.button
                  className="flex min-w-[150px] flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-success px-7 py-3 text-base font-semibold text-white shadow-[0_4px_20px_rgba(76,175,80,0.3)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_6px_30px_rgba(76,175,80,0.4)]"
                  onClick={downloadMergedPdf}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                >
                  <FiDownload />
                  Download Merged PDF
                </motion.button>
              )}

              <button
                className="flex min-w-[100px] items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-6 py-3 text-base font-semibold text-white/80 transition duration-300 hover:-translate-y-0.5 hover:border-white/30 hover:bg-white/15"
                onClick={resetMerger}
              >
                Reset
              </button>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

export default PDFMerger;
