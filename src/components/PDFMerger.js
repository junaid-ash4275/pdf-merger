import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { PDFDocument } from 'pdf-lib';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiUpload, 
  FiFile, 
  FiX, 
  FiDownload, 
  FiMove, 
  FiCheckCircle,
  FiAlertCircle 
} from 'react-icons/fi';
import './PDFMerger.css';

const PDFMerger = () => {
  const [pdfFiles, setPdfFiles] = useState([]);
  const [merging, setMerging] = useState(false);
  const [mergedPdf, setMergedPdf] = useState(null);
  const [notification, setNotification] = useState(null);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const onDrop = useCallback((acceptedFiles) => {
    const newPdfFiles = acceptedFiles
      .filter(file => file.type === 'application/pdf')
      .map(file => ({
        id: `pdf-${Date.now()}-${Math.random()}`,
        file,
        name: file.name,
        size: (file.size / 1024 / 1024).toFixed(2) + ' MB'
      }));

    if (newPdfFiles.length > 0) {
      setPdfFiles(prev => [...prev, ...newPdfFiles]);
      showNotification(`Added ${newPdfFiles.length} PDF file(s)`, 'success');
    } else {
      showNotification('Please select only PDF files', 'error');
    }
  }, []);

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

  const onDragEnd = (result) => {
    if (!result.destination) return;

    const items = Array.from(pdfFiles);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setPdfFiles(items);
  };

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
        const pages = await mergedDoc.copyPages(pdfDoc, pdfDoc.getPageIndices());
        
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
    <div className="pdf-merger-container">
      {/* Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            className={`notification notification-${notification.type}`}
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
        className="merger-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Dropzone */}
        <div 
          {...getRootProps()} 
          className={`dropzone ${isDragActive ? 'dropzone-active' : ''}`}
        >
          <input {...getInputProps()} />
          <div className="dropzone-content">
            <FiUpload className="dropzone-icon" />
            <p className="dropzone-text">
              {isDragActive 
                ? 'Drop your PDF files here...' 
                : 'Drag & drop PDF files here, or click to select'}
            </p>
            <button className="select-button">
              Select PDF Files
            </button>
          </div>
        </div>

        {/* File List */}
        {pdfFiles.length > 0 && (
          <motion.div 
            className="file-list-container"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            transition={{ duration: 0.3 }}
          >
            <div className="file-list-header">
              <h3>PDF Files ({pdfFiles.length})</h3>
              <p className="reorder-hint">
                <FiMove /> Drag to reorder
              </p>
            </div>

            <DragDropContext onDragEnd={onDragEnd}>
              <Droppable droppableId="pdf-list">
                {(provided, snapshot) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className={`file-list ${snapshot.isDraggingOver ? 'dragging-over' : ''}`}
                  >
                    {pdfFiles.map((pdf, index) => (
                      <Draggable key={pdf.id} draggableId={pdf.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`file-item ${snapshot.isDragging ? 'dragging' : ''}`}
                            style={{
                              ...provided.draggableProps.style,
                              opacity: snapshot.isDragging ? 0.8 : 1,
                              transform: snapshot.isDragging 
                                ? `${provided.draggableProps.style?.transform} rotate(2deg)` 
                                : provided.draggableProps.style?.transform
                            }}
                          >
                            <div 
                              {...provided.dragHandleProps}
                              className="drag-handle"
                              title="Drag to reorder"
                            >
                              <FiMove className="drag-icon" />
                            </div>
                            <div className="file-info">
                              <FiFile className="file-icon" />
                              <div className="file-details">
                                <span className="file-name">{pdf.name}</span>
                                <span className="file-size">{pdf.size}</span>
                              </div>
                            </div>
                            <button
                              className="remove-button"
                              onClick={() => removeFile(pdf.id)}
                              title="Remove file"
                            >
                              <FiX />
                            </button>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>

            {/* Action Buttons */}
            <div className="action-buttons">
              <button
                className="merge-button"
                onClick={mergePDFs}
                disabled={merging || pdfFiles.length < 2}
              >
                {merging ? (
                  <>
                    <span className="spinner"></span>
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
                  className="download-button"
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
                className="reset-button"
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
