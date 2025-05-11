// src/components/PDFList.tsx
import React, { useState } from 'react';
import type { PDF } from '../utils/types';
import PDFViewer from './PDFViewer';
import ConfirmationModal from './ConfirmationModal';

interface PDFListProps {
  pdfs: PDF[];
  listType: 'to-study' | 'done'; // To customize empty state messages
  onStatusChange: (id: number, status: 'to-study' | 'done') => void;
  onDelete: (id: number) => void;
}

const PDFList: React.FC<PDFListProps> = ({ pdfs, listType, onStatusChange, onDelete }) => {
  const [selectedPDF, setSelectedPDF] = useState<PDF | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; pdfId: number | null }>({
    isOpen: false,
    pdfId: null,
  });
  
  const formatDate = (timestamp: number): string => new Date(timestamp).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) {return '0 Bytes';}
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']; // Added TB
    const i = Math.max(0, Math.floor(Math.log(bytes) / Math.log(k))); // Ensure i is not negative for bytes < 1
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };
  
  const handleViewPDF = (pdf: PDF) => {
    setSelectedPDF(pdf);
  };
  
  const handleCloseViewer = () => {
    setSelectedPDF(null);
  };
  
  // This function is called by PDFViewer when status changes *within* the viewer
  const handleStatusChangeFromViewer = (id: number, newStatus: 'to-study' | 'done') => {
    onStatusChange(id, newStatus); // Propagate to App.tsx
    // Update the selected PDF state if it's the one being changed
    if (selectedPDF && selectedPDF.id === id) {
      setSelectedPDF({...selectedPDF, status: newStatus});
    }
  };

  const requestDeleteConfirmation = (pdfId: number, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent any parent click handlers
    setConfirmDelete({ isOpen: true, pdfId });
  };

  const handleDeletePDF = () => {
    if (confirmDelete.pdfId === null) {return;}
    
    onDelete(confirmDelete.pdfId);
    setConfirmDelete({ isOpen: false, pdfId: null });
    
    if (selectedPDF && selectedPDF.id === confirmDelete.pdfId) {
      setSelectedPDF(null); // Close viewer if the deleted PDF was being viewed
    }
  };

  const handleCancelDelete = () => {
    setConfirmDelete({ isOpen: false, pdfId: null });
  };

  if (pdfs.length === 0) {
    const emptyMessage = listType === 'to-study' 
      ? 'No PDFs to study. Upload some to get started!'
      : "You haven't completed any PDFs yet. Keep up the great work!";
    return (
      <div className="text-center py-12 bg-gray-800/50 rounded-lg"> {/* Slightly transparent bg */}
        <svg 
          className="mx-auto h-12 w-12 text-gray-500" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="1.5" 
          strokeLinecap="round" 
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
          <polyline points="13 2 13 9 20 9"></polyline>
        </svg>
        <h3 className="mt-3 text-lg font-medium text-gray-200">No PDFs Available</h3>
        <p className="mt-1 text-sm text-gray-400">
          {emptyMessage}
        </p>
      </div>
    );
  }

  return (
    <div>
      {selectedPDF && ( // Ensure selectedPDF is not null before rendering viewer
        <PDFViewer 
          pdf={selectedPDF} 
          onClose={handleCloseViewer}
          onStatusChange={handleStatusChangeFromViewer} // Use the specific handler for viewer changes
        />
      )}
      
      <div className="space-y-4"> {/* Replaced grid with space-y for a list appearance */}
        {pdfs.map((pdf) => (
          pdf.id !== undefined && ( // Ensure pdf.id exists before rendering
            <div 
              key={pdf.id} 
              className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border border-gray-700 rounded-lg bg-gray-900 hover:bg-gray-800/70 transition-colors group"
            >
              <div className="flex items-center mb-3 sm:mb-0 flex-1 min-w-0 mr-4"> {/* min-w-0 for truncation */}
                <svg 
                  className="h-8 w-8 text-purple-400 flex-shrink-0" // Changed color for PDF icon
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  {/* Optional detail lines, can be removed for cleaner icon */}
                  {/* <line x1="16" y1="13" x2="8" y2="13"></line> 
                  <line x1="16" y1="17" x2="8" y2="17"></line> */}
                </svg>
                <div className="ml-3 min-w-0"> {/* min-w-0 for truncation on child */}
                  <h3 className="text-gray-200 font-medium truncate" title={pdf.name}>
                    {pdf.name}
                  </h3>
                  <div className="flex flex-col sm:flex-row text-xs text-gray-400">
                    <span>{formatFileSize(pdf.size)}</span>
                    <span className="hidden sm:inline mx-1.5">•</span>
                    <span>Added on {formatDate(pdf.dateAdded)}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex space-x-2 mt-2 sm:mt-0 flex-shrink-0">
                <button
                  onClick={() => handleViewPDF(pdf)}
                  className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
                  aria-label={`View ${pdf.name}`}
                >
                  View
                </button>
                
                <button
                  onClick={() => onStatusChange(pdf.id!, pdf.status === 'to-study' ? 'done' : 'to-study')}
                  className={`px-3 py-1.5 text-sm text-white rounded transition-colors focus:outline-none focus:ring-2 ${
                    pdf.status === 'to-study'
                      ? 'bg-green-500 hover:bg-green-600 focus:ring-green-400'
                      : 'bg-gray-600 hover:bg-gray-500 focus:ring-gray-400'
                  }`}
                  aria-label={pdf.status === 'to-study' ? `Mark ${pdf.name} as done` : `Mark ${pdf.name} to study again`}
                >
                  {pdf.status === 'to-study' ? 'Mark Done' : 'Study Again'}
                </button>
                
                <button
                  onClick={(e) => requestDeleteConfirmation(pdf.id!, e)}
                  className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
                  aria-label={`Delete ${pdf.name}`}
                >
                  Delete
                </button>
              </div>
            </div>
          )
        ))}
      </div>
      
      <ConfirmationModal
        isOpen={confirmDelete.isOpen}
        title="Delete PDF"
        message="Are you sure you want to delete this PDF? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleDeletePDF}
        onCancel={handleCancelDelete}
        confirmButtonClass="bg-red-600 hover:bg-red-700 focus:ring-red-500"
      />
    </div>
  );
};

export default PDFList;