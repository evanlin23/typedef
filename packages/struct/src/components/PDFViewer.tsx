// src/components/PDFViewer.tsx
import React, { useEffect, useState, useRef, useCallback } from 'react';
import type { PDF } from '../utils/types';
import LoadingSpinner from './LoadingSpinner'; 

interface PDFViewerProps {
  pdf: PDF; 
  onClose: () => void;
  onStatusChange: (id: number, status: 'to-study' | 'done') => void;
  classNotes: string | undefined; 
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
  
  const [localNotes, setLocalNotes] = useState<string>(''); 
  const notesTextareaRef = useRef<HTMLTextAreaElement>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const latestNotesRef = useRef<string>(''); 

  // This effect initializes localNotes from classNotes prop and updates it if classNotes changes
  // (e.g., due to initial load or an update from App.tsx's optimistic update or DB sync)
  useEffect(() => {
    // Only update localNotes if the incoming prop is different from the current localNotes.
    // This handles initialization and updates if classNotes changes from the parent.
    if (classNotes !== undefined && classNotes !== localNotes) {
      console.log("PDFViewer: classNotes prop changed and is different from localNotes. Updating localNotes. Prop:", classNotes, "Local:", localNotes);
      setLocalNotes(classNotes);
      latestNotesRef.current = classNotes; 
    }
    // If classNotes is undefined and localNotes is not empty, it means we are initializing or class was cleared.
    // This ensures localNotes is also cleared.
    else if (classNotes === undefined && localNotes !== '') {
        console.log("PDFViewer: classNotes prop is undefined, clearing localNotes.");
        setLocalNotes('');
        latestNotesRef.current = '';
    }
    // Initialize latestNotesRef on first load if classNotes is already set
    else if (classNotes !== undefined && latestNotesRef.current !== classNotes) {
        latestNotesRef.current = classNotes;
    }
  }, [classNotes]); // CRITICAL: Only depend on classNotes prop here.

  const flushDebouncedNotes = useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null; 
      // Use latestNotesRef.current because localNotes state might not be updated yet if flush is called rapidly
      console.log("PDFViewer: Flushing debounced notes. Calling onClassNotesChange with:", latestNotesRef.current);
      onClassNotesChange(latestNotesRef.current); 
    } else if (latestNotesRef.current !== classNotes) {
      // If no active debounce, but local changes exist that haven't been propagated
      // (e.g., user typed something, then immediately hit close before debounce interval started)
      // This ensures even non-debounced last changes are saved.
      console.log("PDFViewer: No active debounce, but local changes exist. Flushing notes:", latestNotesRef.current);
      onClassNotesChange(latestNotesRef.current);
    }
  }, [onClassNotesChange, classNotes]); // Add classNotes to know what the "source of truth" was

  const debouncedPropagateNotesChange = useCallback((notesToSave: string) => {
    latestNotesRef.current = notesToSave; 
    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    debounceTimeoutRef.current = setTimeout(() => {
      console.log("PDFViewer: Debounce timer fired. Calling onClassNotesChange with:", notesToSave);
      if (notesToSave !== classNotes) { // Only propagate if different from what App already has
          onClassNotesChange(notesToSave); 
      }
      debounceTimeoutRef.current = null; 
    }, 750);
  }, [onClassNotesChange, classNotes]); // Add classNotes to condition propagation

  const handleLocalNotesChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = event.target.value;
    setLocalNotes(newText); // Update local state for immediate UI feedback
    latestNotesRef.current = newText; // Keep ref in sync for immediate flush
    debouncedPropagateNotesChange(newText); 
  };

  // PDF Loading Effect 1 (Object URL)
  useEffect(() => {
    console.log(`PDFViewer Effect 1 (pdf changed): Triggered for PDF ID: ${pdf.id}, Name: ${pdf.name}`);
    let objectUrl: string | null = null;
    let isMounted = true;
    
    setIsLoadingPDF(true); 
    setError(null); 
    setCurrentPdfUrl(''); 
    
    if (!pdf.data) {
      console.warn(`PDFViewer Effect 1: PDF data is missing for PDF ID: ${pdf.id}`);
      setError('PDF data is missing.'); 
      setIsLoadingPDF(false); 
      return;
    }
    
    try {
      const blob = new Blob([pdf.data], { type: 'application/pdf' });
      objectUrl = URL.createObjectURL(blob);
      if (isMounted) {
        console.log(`PDFViewer Effect 1: Object URL created: ${objectUrl} for PDF ID: ${pdf.id}`);
        setCurrentPdfUrl(objectUrl);
      } else { 
        console.log(`PDFViewer Effect 1: Unmounted before setting URL for PDF ID: ${pdf.id}. Revoking new URL.`);
        URL.revokeObjectURL(objectUrl); 
      }
    } catch (err) {
      console.error(`PDFViewer Effect 1: Error creating PDF Object URL for PDF ID: ${pdf.id}`, err);
      if (isMounted) { 
        setError('Failed to prepare PDF for viewing. The file might be corrupted.'); 
        setIsLoadingPDF(false); 
      }
    }
    
    return () => {
      console.log(`PDFViewer Effect 1: Cleanup for PDF ID: ${pdf.id}. Object URL: ${objectUrl}`);
      isMounted = false; 
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [pdf.id, pdf.data]); 

  // PDF Loading Effect 2 (Iframe setup)
  useEffect(() => {
    console.log(`PDFViewer Effect 2 (currentPdfUrl changed): Triggered. currentPdfUrl: ${currentPdfUrl}`);
    const iframe = iframeRef.current;
    
    if (iframe && currentPdfUrl) {
      console.log(`PDFViewer Effect 2: iframe and currentPdfUrl present. Setting up for: ${currentPdfUrl}`);
      if (!isLoadingPDF) setIsLoadingPDF(true); 
      if (error) setError(null); 

      const handleLoad = () => { 
        console.log(`PDFViewer Effect 2: iframe 'load' event fired for: ${currentPdfUrl}`); 
        setIsLoadingPDF(false); 
      };
      const handleError = () => { 
        console.error(`PDFViewer Effect 2: iframe 'error' event fired for: ${currentPdfUrl}`); 
        setIsLoadingPDF(false); 
        setError("The PDF could not be displayed. It might be corrupted or an unsupported format."); 
      };
      
      iframe.addEventListener('load', handleLoad); 
      iframe.addEventListener('error', handleError);
      
      console.log(`PDFViewer Effect 2: Setting iframe.src to: ${currentPdfUrl}`); 
      iframe.src = currentPdfUrl;
      
      return () => {
        console.log(`PDFViewer Effect 2: Cleanup. Removing listeners for: ${currentPdfUrl}`);
        iframe.removeEventListener('load', handleLoad); 
        iframe.removeEventListener('error', handleError);
      };
    } else if (!currentPdfUrl && isLoadingPDF && pdf.data) { // Added pdf.data check
        console.log("PDFViewer Effect 2: currentPdfUrl is empty, but still loading/waiting for URL from Effect 1 (data present).");
    } else if (!currentPdfUrl && !pdf.data && !isLoadingPDF) {
        console.log("PDFViewer Effect 2: No URL, no data, not loading. State is consistent.");
    }
  }, [currentPdfUrl, pdf.data]); // Added pdf.data to ensure this effect re-evaluates if data changes while URL is being processed

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
  }, [onClose, flushDebouncedNotes]); 

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
          {error && !isLoadingPDF && ( 
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 bg-gray-700">
              <svg className="h-12 w-12 text-red-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <p className="text-red-300 font-semibold">Error Displaying PDF</p>
              <p className="text-gray-400 text-sm mt-1">{error}</p>
              <button onClick={onClose} className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">Close</button>
            </div>
          )}
          <iframe
            key={pdf.id} 
            ref={iframeRef}
            className={`w-full h-full border-0 ${isLoadingPDF || error ? 'hidden' : ''}`} 
            title={`PDF Viewer: ${pdf.name}`}
          />
        </main>

        <aside className="w-1/3 max-w-sm lg:max-w-md xl:max-w-lg bg-gray-800 p-4 flex flex-col border-l border-gray-700 overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-100 mb-3">Class Notes</h3>
            <textarea
                ref={notesTextareaRef}
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