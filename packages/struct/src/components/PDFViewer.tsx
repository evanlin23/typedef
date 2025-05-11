// src/components/PDFViewer.tsx
import React, { useEffect, useState, useRef, useCallback } from 'react';
import type { PDF } from '../utils/types';
import LoadingSpinner from './LoadingSpinner';

interface PDFViewerProps {
  pdf: PDF;
  onClose: () => void;
  onStatusChange: (id: number, status: 'to-study' | 'done') => void;
  classNotes: string;
  onClassNotesChange: (notes: string) => void;
}

const PDFViewer: React.FC<PDFViewerProps> = ({
  pdf,
  onClose,
  onStatusChange,
  classNotes,
  onClassNotesChange
}) => {
  const [currentPdfUrl, setCurrentPdfUrl] = useState<string>('');
  const [isLoadingPDF, setIsLoadingPDF] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [localNotes, setLocalNotes] = useState<string>(classNotes);
  const latestNotesRef = useRef<string>(classNotes);

  useEffect(() => {
    if (classNotes !== latestNotesRef.current) {
      // console.log("PDFViewer: classNotes prop changed externally. Updating localNotes and latestNotesRef. Prop:", classNotes, "Current Ref:", latestNotesRef.current);
      setLocalNotes(classNotes);
      latestNotesRef.current = classNotes;
    }
  }, [classNotes]);

  const flushDebouncedNotes = useCallback(() => {
    if (latestNotesRef.current !== classNotes) {
      // console.log("PDFViewer: Flushing notes on close. Calling onClassNotesChange with:", latestNotesRef.current);
      onClassNotesChange(latestNotesRef.current);
    }
  }, [onClassNotesChange, classNotes]);

  const handleLocalNotesChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = event.target.value;
    setLocalNotes(newText);
    latestNotesRef.current = newText;
    onClassNotesChange(newText); // App.tsx will debounce
  };

  // Effect 1: Object URL creation and revocation.
  // Handles setting isLoadingPDF to true at the start of a new PDF load.
  useEffect(() => {
    // console.log(`PDFViewer Effect 1 (pdf changed): Triggered for PDF ID: ${pdf.id}, Name: ${pdf.name}`);
    let objectUrl: string | null = null;
    let isMounted = true;

    setIsLoadingPDF(true); // Start loading for the new PDF
    setError(null);        // Reset previous errors
    setCurrentPdfUrl('');  // Clear previous URL, Effect 2 will react when a new one is set

    if (!pdf.data) {
      console.warn(`PDFViewer Effect 1: PDF data is missing for PDF ID: ${pdf.id}`);
      if (isMounted) {
        setError('PDF data is missing.');
        setIsLoadingPDF(false); // Stop loading as there's no data
      }
      return;
    }

    try {
      const blob = new Blob([pdf.data], { type: 'application/pdf' });
      objectUrl = URL.createObjectURL(blob);
      if (isMounted) {
        // console.log(`PDFViewer Effect 1: Object URL created: ${objectUrl} for PDF ID: ${pdf.id}`);
        setCurrentPdfUrl(objectUrl); // This will trigger Effect 2
                                     // isLoadingPDF remains true until Effect 2's iframe load/error
      } else {
        // console.log(`PDFViewer Effect 1: Unmounted before setting URL. Revoking new URL: ${objectUrl}`);
        URL.revokeObjectURL(objectUrl); // Clean up if unmounted quickly
      }
    } catch (err) {
      console.error(`PDFViewer Effect 1: Error creating PDF Object URL for PDF ID: ${pdf.id}`, err);
      if (isMounted) {
        setError('Failed to prepare PDF for viewing. The file might be corrupted.');
        setIsLoadingPDF(false); // Stop loading due to error
      }
    }

    return () => {
      // console.log(`PDFViewer Effect 1: Cleanup for PDF ID: ${pdf.id}. Revoking Object URL: ${objectUrl}`);
      isMounted = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [pdf.id, pdf.data]); // Only re-run if the PDF itself changes

  // Effect 2: Iframe Source and Load/Error Handling.
  // Reacts to currentPdfUrl changes and manages iframe loading state.
  useEffect(() => {
    const iframe = iframeRef.current;
    // console.log(`PDFViewer Effect 2 (currentPdfUrl changed): Triggered. currentPdfUrl: ${currentPdfUrl}`);

    if (iframe && currentPdfUrl) {
      // isLoadingPDF should already be true from Effect 1 if we have a new currentPdfUrl.
      // No need to set it to true here again.
      // setError(null) was handled by Effect 1.

      const handleLoad = () => {
        // console.log(`PDFViewer Effect 2: iframe 'load' event fired for: ${currentPdfUrl}`);
        setIsLoadingPDF(false); // PDF successfully loaded into iframe
      };
      const handleError = () => {
        // console.error(`PDFViewer Effect 2: iframe 'error' event fired for: ${currentPdfUrl}`);
        setIsLoadingPDF(false); // Loading failed
        setError("The PDF could not be displayed. It might be corrupted or an unsupported format.");
      };

      iframe.addEventListener('load', handleLoad);
      iframe.addEventListener('error', handleError);

      // console.log(`PDFViewer Effect 2: Setting iframe.src to: ${currentPdfUrl}`);
      iframe.src = currentPdfUrl; // Assign src to load the PDF

      return () => {
        // console.log(`PDFViewer Effect 2: Cleanup. Removing listeners for: ${currentPdfUrl}`);
        iframe.removeEventListener('load', handleLoad);
        iframe.removeEventListener('error', handleError);
        // Optional: iframe.src = 'about:blank'; // Clear src on cleanup
      };
    } else if (!currentPdfUrl) {
      // If currentPdfUrl is empty (e.g., cleared by Effect 1 or initial state),
      // ensure loading is false if it wasn't already set by Effect 1 due to an error.
      // This handles the case where Effect 1 finishes by setting currentPdfUrl to ''
      // without immediately setting isLoadingPDF to false (e.g. if pdf.data was present but blob creation failed early)
      // However, Effect 1 already sets isLoadingPDF to false on error or missing data cases.
      // So this might be redundant if Effect 1 is robust.
      // if(isLoadingPDF) setIsLoadingPDF(false); // Consider if truly needed or if Effect 1 covers this.
    }
  }, [currentPdfUrl]); // Only re-run when the URL to load changes.

  // Effect for Esc key
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
  }, [onClose, flushDebouncedNotes]); // flushDebouncedNotes is stable

  const handleStatusToggle = () => {
    if (pdf.id !== undefined) {
      onStatusChange(pdf.id, pdf.status === 'to-study' ? 'done' : 'to-study');
    }
  };

  const handleCloseButtonClick = () => {
    flushDebouncedNotes();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex flex-col backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="pdf-viewer-title">
      <header className="bg-gray-800 text-white p-3 sm:p-4 flex items-center justify-between shadow-md flex-shrink-0">
        <h2 id="pdf-viewer-title" className="font-semibold text-base sm:text-lg truncate max-w-[calc(100%-250px)] sm:max-w-md md:max-w-lg" title={pdf.name}>
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
            onClick={handleCloseButtonClick}
            className="bg-gray-600 hover:bg-gray-500 text-white px-3 py-1.5 rounded text-xs sm:text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
            aria-label="Close PDF viewer"
          >
            Close (Esc)
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 overflow-hidden bg-gray-700 relative">
          {isLoadingPDF && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-700">
              <LoadingSpinner size="large" />
              <p className="mt-3 text-gray-300">Loading PDF...</p>
            </div>
          )}
          {error && !isLoadingPDF && ( // Only show error if not actively loading
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 bg-gray-700">
              <svg className="h-12 w-12 text-red-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <p className="text-red-300 font-semibold">Error Displaying PDF</p>
              <p className="text-gray-400 text-sm mt-1">{error}</p>
              <button onClick={handleCloseButtonClick} className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">Close</button>
            </div>
          )}
          <iframe
            key={pdf.id} // Re-mounts iframe when PDF changes, which is good for ensuring clean state
            ref={iframeRef}
            className={`w-full h-full border-0 ${isLoadingPDF || error ? 'hidden' : ''}`} // Hide iframe if loading or error
            title={`PDF Viewer: ${pdf.name}`}
            // src is set dynamically in Effect 2
          />
        </main>

        <aside className="w-1/3 max-w-sm lg:max-w-md xl:max-w-lg bg-gray-800 p-4 flex flex-col border-l border-gray-700 overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-100 mb-3">Class Notes</h3>
            <textarea
                // ref={notesTextareaRef} // ref not strictly needed if not focusing programmatically
                value={localNotes}
                onChange={handleLocalNotesChange}
                placeholder="Type your notes for this class here..."
                className="flex-1 w-full p-2 bg-gray-900 text-gray-200 border border-gray-700 rounded-md resize-none focus:ring-2 focus:ring-green-400 focus:border-green-400 outline-none"
                aria-label="Class notes"
            />
        </aside>
      </div>
    </div>
  );
};

export default PDFViewer;