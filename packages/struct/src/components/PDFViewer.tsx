// src/components/PDFViewer.tsx
import { useEffect, useState, useRef, useCallback } from 'react';
import type { PDF } from '../utils/types';
import LoadingSpinner from './LoadingSpinner';

/**
 * Props for the PDFViewer component
 */
interface PDFViewerProps {
  /** The PDF object to display */
  pdf: PDF;
  /** Callback when the viewer is closed */
  onClose: () => void;
  /** Callback when the PDF status is changed */
  onStatusChange: (id: number, status: 'to-study' | 'done') => void;
  /** Notes for the current class */
  classNotes: string;
  /** Callback when notes are changed */
  onClassNotesChange: (notes: string) => void;
}

/**
 * Error icon component for the error display
 */
const ErrorIcon = () => (
  <svg 
    className="h-12 w-12 text-red-400 mb-3" 
    fill="none" 
    viewBox="0 0 24 24" 
    stroke="currentColor"
    aria-hidden="true"
  >
    <path 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      strokeWidth="2" 
      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
    />
  </svg>
);

/**
 * Loading state component for the PDF viewer
 */
const PDFLoadingState = () => (
  <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-700">
    <LoadingSpinner size="large" />
    <p className="mt-3 text-gray-300">Loading PDF...</p>
  </div>
);

/**
 * Error state component for the PDF viewer
 * @param error - The error message to display
 * @param onClose - Callback when the close button is clicked
 */
const PDFErrorState = ({ error, onClose }: { error: string; onClose: () => void }) => (
  <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 bg-gray-700">
    <ErrorIcon />
    <p className="text-red-300 font-semibold">Error Displaying PDF</p>
    <p className="text-gray-400 text-sm mt-1">{error}</p>
    <button 
      onClick={onClose} 
      className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
    >
      Close
    </button>
  </div>
);

/**
 * Header component for the PDF viewer
 */
interface PDFViewerHeaderProps {
  /** The name of the PDF */
  pdfName: string;
  /** The current status of the PDF */
  pdfStatus: 'to-study' | 'done';
  /** Callback when the status toggle button is clicked */
  onStatusToggle: () => void;
  /** Callback when the close button is clicked */
  onClose: () => void;
}

const PDFViewerHeader = ({ pdfName, pdfStatus, onStatusToggle, onClose }: PDFViewerHeaderProps) => (
  <header className="bg-gray-800 text-white p-3 sm:p-4 flex items-center justify-between shadow-md flex-shrink-0">
    <h2 
      id="pdf-viewer-title" 
      className="font-semibold text-base sm:text-lg truncate max-w-[calc(100%-250px)] sm:max-w-md md:max-w-lg" 
      title={pdfName}
    >
      {pdfName}
    </h2>
    <div className="flex items-center space-x-2 sm:space-x-3">
      <button
        onClick={onStatusToggle}
        className={`
          px-3 py-1.5 text-xs sm:text-sm rounded transition-colors 
          focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 
          ${pdfStatus === 'to-study'
            ? 'bg-green-500 hover:bg-green-600 text-white focus:ring-green-400'
            : 'bg-blue-500 hover:bg-blue-600 text-white focus:ring-blue-400'}
        `}
      >
        {pdfStatus === 'to-study' ? 'Mark as Done' : 'Mark To Study'}
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
);

/**
 * Notes panel component for the PDF viewer
 */
interface NotesAreaProps {
  /** The current notes content */
  notes: string;
  /** Callback when notes are changed */
  onNotesChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
}

const NotesArea = ({ notes, onNotesChange }: NotesAreaProps) => (
  <aside className="w-1/3 max-w-sm lg:max-w-md xl:max-w-lg bg-gray-800 p-4 flex flex-col border-l border-gray-700 overflow-y-auto">
    <h3 className="text-lg font-semibold text-gray-100 mb-3">Class Notes</h3>
    <textarea
      value={notes}
      onChange={onNotesChange}
      placeholder="Type your notes for this class here..."
      className="flex-1 w-full p-2 bg-gray-900 text-gray-200 border border-gray-700 rounded-md resize-none focus:ring-2 focus:ring-green-400 focus:border-green-400 outline-none"
      aria-label="Class notes"
    />
  </aside>
);

/**
 * Component for viewing PDF files with notes functionality
 */
const PDFViewer = ({
  pdf,
  onClose,
  onStatusChange,
  classNotes,
  onClassNotesChange
}: PDFViewerProps) => {
  // State for PDF rendering
  const [currentPdfUrl, setCurrentPdfUrl] = useState<string>('');
  const [isLoadingPDF, setIsLoadingPDF] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // State for notes management
  const [localNotes, setLocalNotes] = useState<string>(classNotes);
  const latestNotesRef = useRef<string>(classNotes);

  /**
   * Sync local notes state when classNotes prop changes externally
   */
  useEffect(() => {
    if (classNotes !== latestNotesRef.current) {
      setLocalNotes(classNotes);
      latestNotesRef.current = classNotes;
    }
  }, [classNotes]);

  /**
   * Save any pending note changes when component is closed
   */
  const flushDebouncedNotes = useCallback(() => {
    if (latestNotesRef.current !== classNotes) {
      onClassNotesChange(latestNotesRef.current);
    }
  }, [onClassNotesChange, classNotes]);

  /**
   * Handle changes to the notes textarea
   */
  const handleLocalNotesChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = event.target.value;
    setLocalNotes(newText);
    latestNotesRef.current = newText;
    onClassNotesChange(newText); // App.tsx will debounce
  }, [onClassNotesChange]);

  /**
   * Create object URL for PDF data and handle loading state
   */
  useEffect(() => {
    let objectUrl: string | null = null;
    let isMounted = true;

    // Reset state for new PDF
    setIsLoadingPDF(true);
    setError(null);
    setCurrentPdfUrl('');

    // Check if PDF data exists
    if (!pdf.data) {
      console.warn(`PDF data is missing for PDF ID: ${pdf.id}`);
      if (isMounted) {
        setError('PDF data is missing.');
        setIsLoadingPDF(false);
      }
      return;
    }

    // Create blob and object URL
    try {
      const blob = new Blob([pdf.data], { type: 'application/pdf' });
      objectUrl = URL.createObjectURL(blob);
      
      if (isMounted) {
        setCurrentPdfUrl(objectUrl);
      } else {
        URL.revokeObjectURL(objectUrl);
      }
    } catch (err) {
      console.error(`Error creating PDF Object URL for PDF ID: ${pdf.id}`, err);
      if (isMounted) {
        setError('Failed to prepare PDF for viewing. The file might be corrupted.');
        setIsLoadingPDF(false);
      }
    }

    // Cleanup function
    return () => {
      isMounted = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [pdf.id, pdf.data]);

  /**
   * Handle iframe loading and error events
   */
  useEffect(() => {
    const iframe = iframeRef.current;

    if (iframe && currentPdfUrl) {
      const handleLoad = () => {
        setIsLoadingPDF(false);
      };
      
      const handleError = () => {
        setIsLoadingPDF(false);
        setError("The PDF could not be displayed. It might be corrupted or an unsupported format.");
      };

      // Add event listeners
      iframe.addEventListener('load', handleLoad);
      iframe.addEventListener('error', handleError);
      
      // Set iframe source
      iframe.src = currentPdfUrl;

      // Cleanup function
      return () => {
        iframe.removeEventListener('load', handleLoad);
        iframe.removeEventListener('error', handleError);
      };
    }
  }, [currentPdfUrl]);

  /**
   * Handle Escape key to close the viewer
   */
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        flushDebouncedNotes();
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleEscKey);
    
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [onClose, flushDebouncedNotes]);

  /**
   * Toggle the PDF status between 'to-study' and 'done'
   */
  const handleStatusToggle = useCallback(() => {
    if (pdf.id !== undefined) {
      onStatusChange(pdf.id, pdf.status === 'to-study' ? 'done' : 'to-study');
    }
  }, [pdf.id, pdf.status, onStatusChange]);

  /**
   * Handle close button click
   */
  const handleCloseButtonClick = useCallback(() => {
    flushDebouncedNotes();
    onClose();
  }, [flushDebouncedNotes, onClose]);

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-80 z-50 flex flex-col backdrop-blur-sm" 
      role="dialog" 
      aria-modal="true" 
      aria-labelledby="pdf-viewer-title"
    >
      <PDFViewerHeader 
        pdfName={pdf.name}
        pdfStatus={pdf.status}
        onStatusToggle={handleStatusToggle}
        onClose={handleCloseButtonClick}
      />

      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 overflow-hidden bg-gray-700 relative">
          {isLoadingPDF && <PDFLoadingState />}
          
          {error && !isLoadingPDF && (
            <PDFErrorState error={error} onClose={handleCloseButtonClick} />
          )}
          
          <iframe
            key={pdf.id}
            ref={iframeRef}
            className={`w-full h-full border-0 ${isLoadingPDF || error ? 'hidden' : ''}`}
            title={`PDF Viewer: ${pdf.name}`}
          />
        </main>

        <NotesArea 
          notes={localNotes}
          onNotesChange={handleLocalNotesChange}
        />
      </div>
    </div>
  );
};

export default PDFViewer;