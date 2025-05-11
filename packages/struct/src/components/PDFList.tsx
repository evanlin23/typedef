import React, { useState } from 'react';
import type { PDF } from '../utils/types';
import PDFViewer from './PDFViewer';
import ConfirmationModal from './ConfirmationModal';

interface PDFListProps {
  pdfs: PDF[];
  onStatusChange: (id: number, status: 'to-study' | 'done') => void;
  onDelete: (id: number) => void;
}

const PDFList: React.FC<PDFListProps> = ({ pdfs, onStatusChange, onDelete }) => {
  const [selectedPDF, setSelectedPDF] = useState<PDF | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; pdfId: number | null }>({
    isOpen: false,
    pdfId: null,
  });
  
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString();
  };
  
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  
  const handleViewPDF = (pdf: PDF) => {
    setSelectedPDF(pdf);
  };
  
  const handleCloseViewer = () => {
    setSelectedPDF(null);
  };
  
  const handleStatusChange = (id: number, newStatus: 'to-study' | 'done') => {
    onStatusChange(id, newStatus);
    
    // Update the selected PDF if it's the one being changed
    if (selectedPDF && selectedPDF.id === id) {
      setSelectedPDF({...selectedPDF, status: newStatus});
    }
  };

  const handleConfirmDelete = (pdfId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDelete({ isOpen: true, pdfId });
  };

  const handleDeletePDF = () => {
    if (confirmDelete.pdfId === null) return;
    
    onDelete(confirmDelete.pdfId);
    setConfirmDelete({ isOpen: false, pdfId: null });
    
    // If the deleted PDF is the one being viewed, close the viewer
    if (selectedPDF && selectedPDF.id === confirmDelete.pdfId) {
      setSelectedPDF(null);
    }
  };

  const handleCancelDelete = () => {
    setConfirmDelete({ isOpen: false, pdfId: null });
  };

  if (pdfs.length === 0) {
    return (
      <div className="text-center py-12">
        <svg 
          className="mx-auto h-12 w-12 text-gray-400" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
          <polyline points="13 2 13 9 20 9"></polyline>
        </svg>
        <h3 className="mt-2 text-lg font-medium text-gray-200">No PDFs available</h3>
        <p className="mt-1 text-gray-400">
          {pdfs.length > 0 && pdfs[0]?.status === 'to-study' 
            ? 'Upload some PDFs to get started'
            : 'You haven\'t completed any PDFs yet'}
        </p>
      </div>
    );
  }

  return (
    <div>
      {selectedPDF ? (
        <PDFViewer 
          pdf={selectedPDF} 
          onClose={handleCloseViewer}
          onStatusChange={handleStatusChange}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {pdfs.map((pdf) => (
            <div 
              key={pdf.id} 
              className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border border-gray-700 rounded-lg bg-gray-900 hover:bg-gray-800 transition-colors"
            >
              <div className="flex items-center mb-2 sm:mb-0">
                <svg 
                  className="h-8 w-8 text-gray-400" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
                <div className="ml-3">
                  <h3 className="text-gray-200 font-medium truncate max-w-xs">
                    {pdf.name}
                  </h3>
                  <div className="flex text-xs text-gray-400">
                    <span>{formatFileSize(pdf.size)}</span>
                    <span className="mx-2">•</span>
                    <span>Added on {formatDate(pdf.dateAdded)}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex space-x-2 mt-2 sm:mt-0">
                <button
                  onClick={() => handleViewPDF(pdf)}
                  className="px-3 py-1 text-sm bg-blue-500 text-gray-200 rounded hover:opacity-90 transition-opacity"
                >
                  View
                </button>
                
                {pdf.id !== undefined && (
                  <>
                    <button
                      onClick={() => onStatusChange(pdf.id!, pdf.status === 'to-study' ? 'done' : 'to-study')}
                      className={`px-3 py-1 text-sm rounded hover:opacity-90 transition-opacity ${
                        pdf.status === 'to-study'
                          ? 'bg-green-500 text-gray-200'
                          : 'bg-gray-600 text-gray-200'
                      }`}
                    >
                      {pdf.status === 'to-study' ? 'Mark Done' : 'Study Again'}
                    </button>
                    
                    <button
                      onClick={(e) => handleConfirmDelete(pdf.id!, e)}
                      className="px-3 py-1 text-sm bg-red-600 text-gray-200 rounded hover:opacity-90 transition-opacity"
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      
      <ConfirmationModal
        isOpen={confirmDelete.isOpen}
        title="Delete PDF"
        message="Are you sure you want to delete this PDF? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleDeletePDF}
        onCancel={handleCancelDelete}
      />
    </div>
  );
};

export default PDFList;