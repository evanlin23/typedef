// src/App.tsx
import { useEffect, useState, useCallback, useRef } from 'react';
import { initDB, addPDF, updatePDFStatus, deletePDF, getClass, getClassPDFs, updateClass, updateMultiplePDFOrders } from './utils/db';
import Header from './components/Header';
import FileUpload from './components/FileUpload';
import PDFList from './components/PDFList';
import ProgressStats from './components/ProgressStats';
import ClassManagement from './components/ClassManagement';
import type { PDF, Class } from './utils/types';
import Footer from './components/Footer';
import LoadingSpinner from './components/LoadingSpinner'; 
import PDFViewer from './components/PDFViewer';

function App() {
  const [pdfs, setPdfs] = useState<PDF[]>([]);
  const [isLoading, setIsLoading] = useState(true); // General loading, includes DB init and class data loading
  const [isDBInitialized, setIsDBInitialized] = useState(false);
  const [activeTab, setActiveTab] = useState<'to-study' | 'done' | 'notes'>('to-study');
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [viewingPDF, setViewingPDF] = useState<PDF | null>(null);

  const notesUpdateDebounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentSelectedClassIdRef = useRef<number | null>(null); 

  useEffect(() => {
    currentSelectedClassIdRef.current = selectedClassId;
  }, [selectedClassId]);


  useEffect(() => {
    const setupDatabase = async() => {
      // setIsLoading(true) is already default
      try {
        await initDB();
        setIsDBInitialized(true);
      } catch (error) {
        console.error('Failed to initialize database:', error);
        // Potentially set a global error state for UI feedback
      } finally {
        setIsLoading(false); // DB init done, or failed. Subsequent loading is for class data.
      }
    };
    setupDatabase();
  }, []);

  const refreshData = useCallback(async (keepLoadingState = false) => {
    if (!isDBInitialized) { // DB not ready, defer refresh
        console.log("DB not initialized, refreshData deferred.");
        return;
    }
    if (selectedClassId === null) { // No class selected, clear data
      setSelectedClass(null);
      setPdfs([]);
      return;
    }

    console.log(`Refreshing data for class ID: ${selectedClassId}, keepLoadingState: ${keepLoadingState}`);
    if (!keepLoadingState) {
        setIsLoading(true);
    }

    try {
      const clsData = await getClass(selectedClassId);
      if (clsData) {
        setSelectedClass(clsData);
        const classPDFsData = await getClassPDFs(selectedClassId); 
        setPdfs(classPDFsData);
      } else {
        // Class not found (e.g., was deleted)
        console.warn(`Class with ID ${selectedClassId} not found during refresh. Navigating back.`);
        setSelectedClass(null); 
        setPdfs([]);
        setSelectedClassId(null); // This will trigger navigation to ClassManagement
      }
    } catch (error) {
      console.error(`Error loading data for class ID ${selectedClassId}:`, error);
      // On error, clear data and navigate back to prevent inconsistent state
      setSelectedClass(null); 
      setPdfs([]);
      setSelectedClassId(null); // Navigate back
      // Optionally, display an error message to the user
    } finally {
      if (!keepLoadingState) {
        setIsLoading(false);
      }
    }
  }, [selectedClassId, isDBInitialized]); // Removed refreshData from its own deps

  useEffect(() => {
    // This effect handles loading class data when selectedClassId changes,
    // or clearing data if selectedClassId becomes null.
    if (selectedClassId !== null) {
        if (isDBInitialized) {
            refreshData();
        } else {
            console.log("Waiting for DB initialization to refresh class data...");
            // setIsLoading(true); // Ensure loading indicator is on if DB isn't ready
        }
    } else {
        // selectedClassId is null, means we are in ClassManagement view or navigating there.
        // Clear out any existing class-specific data.
        setSelectedClass(null);
        setPdfs([]);
        // setIsLoading(false); // Not loading a specific class anymore
    }
  }, [selectedClassId, isDBInitialized, refreshData]); // refreshData is stable due to useCallback

  const handleFileUpload = async (files: FileList) => {
    if (selectedClassId === null) {
      alert('Please select a class before uploading files.');
      return;
    }
  
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;
  
    setIsLoading(true); // Indicate loading for uploads
  
    try {
      const skippedFiles: string[] = [];
      const pdfUploadOperations = fileArray
        .filter(file => {
          if (file.type === 'application/pdf') return true;
          console.warn(`File ${file.name} is not a PDF and was skipped.`);
          skippedFiles.push(file.name);
          return false;
        })
        .map((file) => async () => { 
          try {
            const arrayBuffer = await file.arrayBuffer();
            const pdfData: Omit<PDF, 'id'> = {
              name: file.name,
              size: file.size,
              lastModified: file.lastModified,
              data: arrayBuffer,
              status: 'to-study',
              dateAdded: Date.now(),
              classId: selectedClassId,
              orderIndex: undefined, 
            };
            await addPDF(pdfData);
            return { name: file.name, status: 'fulfilled' as const };
          } catch (error) {
            console.error(`Error processing file ${file.name}:`, error);
            return { name: file.name, status: 'rejected' as const, error };
          }
        });
  
      if (pdfUploadOperations.length === 0) {
        if (skippedFiles.length > 0) alert(`All selected files were skipped as they are not PDFs: ${skippedFiles.join(', ')}`);
        // No actual PDF processing to do. Reset loading only if it was set for this operation.
        // The finally block will handle setIsLoading(false) if refreshData is called.
        // For now, if no PDF ops, we expect refreshData NOT to run, so manage loading here.
        setIsLoading(false); 
        return;
      }
      
      const results = await Promise.allSettled(pdfUploadOperations.map(op => op()));
      let successfulUploads = 0;
      let failedUploads = 0;
  
      results.forEach(result => {
        if (result.status === 'fulfilled' && result.value.status === 'fulfilled') successfulUploads++;
        else failedUploads++;
      });
  
      if (failedUploads > 0) {
        alert(`${failedUploads} PDF file(s) could not be uploaded. ${successfulUploads} PDF(s) uploaded successfully. ${skippedFiles.length > 0 ? skippedFiles.length + ' non-PDF file(s) were skipped.' : ''}`);
      } else if (skippedFiles.length > 0) {
        alert(`${successfulUploads} PDF file(s) uploaded successfully. ${skippedFiles.length} non-PDF file(s) were skipped.`);
      }
  
    } catch (error) {
      console.error('Error during file upload setup or batch processing:', error);
      alert('An unexpected error occurred during file upload. Please check the console.');
    } finally {
      // Refresh data only if there were potential changes (successful uploads)
      // and a class is still selected.
      if (selectedClassId !== null && pdfs.length + fileArray.filter(f => f.type === 'application/pdf').length > pdfs.length) { // crude check if new PDFs were added
        await refreshData(); // This will set isLoading appropriately
      } else {
        setIsLoading(false); // Explicitly turn off if no refreshData call
      }
    }
  };

  const handleStatusChange = async(id: number, newStatus: 'to-study' | 'done') => {
    try {
      await updatePDFStatus(id, newStatus);
      await refreshData(true); 
      if (viewingPDF && viewingPDF.id === id) {
        setViewingPDF(prev => prev ? { ...prev, status: newStatus } : null);
      }
    } catch (error) {
      console.error('Error updating PDF status:', error);
    }
  };

  const handleDeletePDF = async(id: number) => {
    try {
      await deletePDF(id);
      await refreshData(true); // Keep loading state if already loading something, then refresh
      if (viewingPDF && viewingPDF.id === id) {
        setViewingPDF(null); 
      }
    } catch (error) {
      console.error('Error deleting PDF:', error);
    }
  };

  const handleSelectClass = (classId: number) => {
    setActiveTab('to-study'); 
    // Setting selectedClassId will trigger the useEffect to load data
    if (selectedClassId !== classId) { // Avoid redundant processing if same class clicked
        setSelectedClassId(classId);
    } else if (!selectedClass) { // Same class ID, but class data might be missing (e.g. after error)
        refreshData();
    }
  };

  const handleBackToClasses = () => {
    setSelectedClassId(null); 
  };

  const handleCreateAndSelectClass = (classId: number) => {
    setActiveTab('to-study');
    setSelectedClassId(classId); 
  };

  const handleViewPDF = (pdf: PDF) => {
    setViewingPDF(pdf);
  };

  const handleClosePDFViewer = () => {
    setViewingPDF(null);
  };

  const saveNotesToDB = useCallback(async (classId: number, notesToSave: string) => {
    try {
      await updateClass(classId, { notes: notesToSave });
      console.log("Notes saved for class ID:", classId);
    } catch (error) {
      console.error('Failed to save class notes to DB:', error);
    }
  }, []); 

  const handleClassNotesChange = useCallback((newNotes: string) => {
    setSelectedClass(prevClass => {
      if (prevClass && prevClass.id === currentSelectedClassIdRef.current) {
        return { ...prevClass, notes: newNotes };
      }
      return prevClass;
    });

    if (notesUpdateDebounceTimeoutRef.current) {
      clearTimeout(notesUpdateDebounceTimeoutRef.current);
    }

    notesUpdateDebounceTimeoutRef.current = setTimeout(() => {
      if (currentSelectedClassIdRef.current !== null) {
        saveNotesToDB(currentSelectedClassIdRef.current, newNotes);
      }
    }, 750);
  }, [saveNotesToDB]); 

  useEffect(() => {
    return () => { 
      if (notesUpdateDebounceTimeoutRef.current) {
        clearTimeout(notesUpdateDebounceTimeoutRef.current);
      }
    };
  }, []);

  const handlePDFOrderChange = async (orderedPDFsInActiveTab: PDF[]) => {
    if (!selectedClassId) return;
    const allCurrentPdfsForClass = [...pdfs]; 
    let combinedPdfs: PDF[];

    if (activeTab === 'to-study') {
        const donePdfs = allCurrentPdfsForClass.filter(p => p.status === 'done' && !orderedPDFsInActiveTab.find(op => op.id === p.id));
        combinedPdfs = [...orderedPDFsInActiveTab, ...donePdfs];
    } else if (activeTab === 'done') {
        const toStudyPdfs = allCurrentPdfsForClass.filter(p => p.status === 'to-study' && !orderedPDFsInActiveTab.find(op => op.id === p.id));
        combinedPdfs = [...toStudyPdfs, ...orderedPDFsInActiveTab];
    } else { return; }
    
    const uniqueCombinedPdfs = combinedPdfs.filter((pdf, index, self) =>
        pdf.id !== undefined && index === self.findIndex((p) => p.id === pdf.id)
    );

    const finalUpdates = uniqueCombinedPdfs.map((pdf, index) => ({ id: pdf.id!, orderIndex: index, }));

    try {
        setIsLoading(true); 
        setPdfs(uniqueCombinedPdfs); // Optimistic update
        await updateMultiplePDFOrders(finalUpdates);
        await refreshData(true); 
    } catch (error) {
        console.error('Error updating PDF order:', error);
        await refreshData(true); 
    } finally {
        setIsLoading(false);
    }
};

  const toStudyPDFs = pdfs.filter(pdf => pdf.status === 'to-study');
  const donePDFs = pdfs.filter(pdf => pdf.status === 'done');

  const statsData = {
    total: selectedClass?.pdfCount || 0,
    toStudy: (selectedClass?.pdfCount || 0) - (selectedClass?.doneCount || 0),
    done: selectedClass?.doneCount || 0,
  };
  
  // Render Logic
  if (!isDBInitialized) { // DB not yet initialized (could be initial load or error during init)
    return (
      <div className="flex flex-col min-h-screen bg-gray-900 justify-center items-center">
        <LoadingSpinner />
        <p className="text-gray-400 mt-4">Initializing Application...</p>
        {/* Optionally show error message if DB init failed */}
      </div>
    );
  }

  if (selectedClassId === null) { 
    // No class selected, show ClassManagement screen
    return <ClassManagement onSelectClass={handleSelectClass} onCreateClass={handleCreateAndSelectClass} />;
  }

  // A class is selected (selectedClassId is not null)
  // Show loading spinner if data is being fetched for this class or if selectedClass is not yet populated
  if (isLoading || !selectedClass) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-900 text-gray-200">
        <Header 
            className={selectedClass?.name || "Loading Class..."} // Show name if available, else loading text
            onBackClick={handleBackToClasses} 
            showBackButton={true} 
        />
        <main className="flex-1 container mx-auto px-4 py-6 flex justify-center items-center">
          <LoadingSpinner size="large" />
        </main>
        <Footer />
      </div>
    );
  }

  // If we reach here, selectedClassId is set, selectedClass is populated, and isLoading is false for class data
  return (
    <div className="flex flex-col min-h-screen bg-gray-900 text-gray-200">
      <Header 
        className={selectedClass.name} 
        onBackClick={handleBackToClasses} 
        showBackButton={true}
      />
      <main className="flex-1 container mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row md:space-x-6">
          <div className="w-full md:w-1/3 mb-6 md:mb-0">
            <FileUpload onUpload={handleFileUpload} />
            {selectedClass && <ProgressStats stats={statsData} />}
          </div>
          
          <div className="w-full md:w-2/3">
            <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
              <div className="flex mb-4 border-b border-gray-700">
                <button
                  aria-current={activeTab === 'to-study'}
                  className={`px-4 py-2 text-lg transition-colors ${
                    activeTab === 'to-study'
                      ? 'text-green-400 border-b-2 border-green-400'
                      : 'text-gray-400 hover:text-gray-100'
                  }`}
                  onClick={() => setActiveTab('to-study')}
                >
                  To Study ({toStudyPDFs.length})
                </button>
                <button
                  aria-current={activeTab === 'done'}
                  className={`px-4 py-2 text-lg transition-colors ${
                    activeTab === 'done'
                      ? 'text-green-400 border-b-2 border-green-400'
                      : 'text-gray-400 hover:text-gray-100'
                  }`}
                  onClick={() => setActiveTab('done')}
                >
                  Done ({donePDFs.length})
                </button>
                <button 
                  aria-current={activeTab === 'notes'}
                  className={`px-4 py-2 text-lg transition-colors ${
                    activeTab === 'notes'
                      ? 'text-green-400 border-b-2 border-green-400'
                      : 'text-gray-400 hover:text-gray-100'
                  }`}
                  onClick={() => setActiveTab('notes')}
                >
                  Notes
                </button>
              </div>
              
              {/* Loading spinner for PDF list content if isLoading is true (e.g. during file upload) 
                  AND the list itself is empty, to avoid showing spinner over existing content.
                  This `isLoading` here is the general one, might be true during uploads.
              */}
              {isLoading && (activeTab !== 'notes' && !pdfs.length) ? ( 
                <LoadingSpinner />
              ) : (
                <>
                  {activeTab === 'notes' ? (
                    <div className="h-[500px]">
                      <textarea
                        value={selectedClass?.notes || ''}
                        onChange={(e) => handleClassNotesChange(e.target.value)}
                        placeholder="Class notes will appear here. You can also edit them in the PDF viewer."
                        className="w-full h-full p-3 bg-gray-900 text-gray-200 border border-gray-700 rounded-md resize-none focus:ring-2 focus:ring-green-400 focus:border-green-400 outline-none"
                        aria-label="Class notes editor"
                      />
                    </div>
                  ) : (
                    <PDFList
                      pdfs={activeTab === 'to-study' ? toStudyPDFs : donePDFs}
                      listType={activeTab}
                      onStatusChange={handleStatusChange}
                      onDelete={handleDeletePDF}
                      onViewPDF={handleViewPDF}
                      onOrderChange={handlePDFOrderChange}
                    />
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </main>
      {viewingPDF && selectedClass && (
        <PDFViewer
          pdf={viewingPDF}
          onClose={handleClosePDFViewer}
          onStatusChange={handleStatusChange} 
          classNotes={selectedClass.notes} 
          onClassNotesChange={handleClassNotesChange}
        />
      )}
      <Footer />
    </div>
  );
}

export default App;