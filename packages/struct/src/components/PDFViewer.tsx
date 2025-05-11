// src/components/PDFViewer.tsx
import React, { useEffect, useState, useRef } from 'react';
import type { PDF } from '../utils/types';
import LoadingSpinner from './LoadingSpinner'; // Use the generic spinner

interface PDFViewerProps {
  pdf: PDF;
  onClose: () => void;
  onStatusChange: (id: number, status: 'to-study' | 'done') => void; // To App.tsx for data refresh
}

const PDFViewer: React.FC<PDFViewerProps> = ({ pdf, onClose, onStatusChange }) => {
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    let isMounted = true;
    let objectUrl: string | null = null;

    const createPdfUrl = () => {
      if (!pdf.data) {
        setError('PDF data is missing.');
        setIsLoading(false);
        return;
      }
      
      setIsLoading(true);
      setError(null);
      try {
        const blob = new Blob([pdf.data], { type: 'application/pdf' });
        objectUrl = URL.createObjectURL(blob);
        
        if (isMounted) {
          setPdfUrl(objectUrl);
        } else {
          URL.revokeObjectURL(objectUrl); // Clean up if unmounted before setting state
        }
      } catch (err) {
        console.error('Error creating PDF URL:', err);
        if (isMounted) {
          setError('Failed to load PDF. The file might be corrupted or in an unsupported format.');
        }
      } finally {
        if (isMounted) {
          // setIsLoading(false); // iframe onload will handle this
        }
      }
    };
    
    createPdfUrl();
    
    return () => {
      isMounted = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        setPdfUrl(''); // Clear URL state
      }
    };
  }, [pdf]); // Re-create URL if the PDF object itself changes

  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscKey);
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [onClose]);

  const handleStatusToggle = () => {
    if (pdf.id !== undefined) {
      const newStatus = pdf.status === 'to-study' ? 'done' : 'to-study';
      onStatusChange(pdf.id, newStatus); // This will trigger data refresh in App.tsx
      // which will then provide updated 'pdf' prop here
    }
  };

  const handleIframeLoad = () => {
    setIsLoading(false);
  };
  
  const handleIframeError = () => {
    setIsLoading(false);
    setError("The PDF could not be displayed by the browser's viewer.");
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex flex-col backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="pdf-viewer-title">
      <header className="bg-gray-800 text-white p-3 sm:p-4 flex items-center justify-between shadow-md flex-shrink-0">
        <h2 id="pdf-viewer-title" className="font-semibold text-base sm:text-lg truncate max-w-xs sm:max-w-md md:max-w-lg" title={pdf.name}>
          {pdf.name}
        </h2>
        
        <div className="flex items-center space-x-2 sm:space-x-3">
          <button
            onClick={handleStatusToggle}
            className={`px-3 py-1.5 text-xs sm:text-sm rounded transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 ${
              pdf.status === 'to-study'
                ? 'bg-green-500 hover:bg-green-600 text-white focus:ring-green-400'
                : 'bg-blue-500 hover:bg-blue-600 text-white focus:ring-blue-400'
            }`}
          >
            {pdf.status === 'to-study' ? 'Mark as Done' : 'Mark To Study'}
          </button>
          
          <button
            onClick={onClose}
            className="bg-gray-600 hover:bg-gray-500 text-white px-3 py-1.5 rounded text-xs sm:text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
            aria-label="Close PDF viewer"
          >
            Close (Esc)
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden bg-gray-700 relative"> {/* Changed bg for pdf area */}
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-700">
            <LoadingSpinner size="large" />
            <p className="mt-3 text-gray-300">Loading PDF...</p>
          </div>
        )}
        {error && !isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 bg-gray-700">
            <svg className="h-12 w-12 text-red-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <p className="text-red-300 font-semibold">Error Displaying PDF</p>
            <p className="text-gray-400 text-sm mt-1">{error}</p>
            <button onClick={onClose} className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">Close</button>
          </div>
        )}
        {!isLoading && !error && pdfUrl && (
          <iframe
            ref={iframeRef}
            src={pdfUrl}
            className="w-full h-full border-0"
            title={`PDF Viewer: ${pdf.name}`}
            onLoad={handleIframeLoad}
            onError={handleIframeError} // Basic error handling for iframe content
          />
        )}
      </main>
    </div>
  );
};

export default PDFViewer;