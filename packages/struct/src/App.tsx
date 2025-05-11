// src/App.tsx
import { useEffect, useState, useCallback, useRef } from 'react';
import { addPDF, updatePDFStatus, deletePDF, updateClass, updateMultiplePDFOrders } from './utils/db';
import Header from './components/Header';
import FileUpload from './components/FileUpload';
import PDFList from './components/PDFList';
import ProgressStats from './components/ProgressStats';
import ClassManagement from './components/ClassManagement';
import type { PDF } from './utils/types';
import Footer from './components/Footer';
import LoadingSpinner from './components/LoadingSpinner';
import PDFViewer from './components/PDFViewer';

import { useDBInitialization } from './hooks/useDBInitialization';
import { useClassData } from './hooks/useClassData';

function App() {
  const { isDBInitialized, dbError, isInitializing: isDBInitializing } = useDBInitialization();
  const {
    selectedClassId, setSelectedClassId, // selectedClassId is now string | null
    selectedClass, setSelectedClass,
    pdfs, setPdfs,
    isLoadingClassData,
    classDataError,
    refreshData
  } = useClassData(isDBInitialized);

  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'to-study' | 'done' | 'notes'>('to-study');
  const [viewingPDF, setViewingPDF] = useState<PDF | null>(null);

  const notesUpdateDebounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentSelectedClassIdRef = useRef<string | null>(null); // Changed

  useEffect(() => {
    currentSelectedClassIdRef.current = selectedClassId;
  }, [selectedClassId]);

  useEffect(() => {
    if (classDataError && classDataError.message.includes("not found") && selectedClassId !== null) {
        console.warn("Class not found due to error, navigating back to class management.");
        setSelectedClassId(null);
    }
  }, [classDataError, selectedClassId, setSelectedClassId]);

  const handleFileUpload = async (files: FileList) => {
    if (selectedClassId === null) {
      alert('Please select a class before uploading files.');
      return;
    }

    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    setIsProcessing(true);
    let successfullyAddedCount = 0;

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
              classId: selectedClassId, // This is now a string (UUID)
            };
            await addPDF(pdfData);
            successfullyAddedCount++;
            return { name: file.name, status: 'fulfilled' as const };
          } catch (error) {
            console.error(`Error processing file ${file.name}:`, error);
            return { name: file.name, status: 'rejected' as const, error };
          }
        });

      if (pdfUploadOperations.length === 0) {
        if (skippedFiles.length > 0) alert(`All selected files were skipped: ${skippedFiles.join(', ')}`);
        setIsProcessing(false);
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
        alert(`${failedUploads} PDF(s) failed. ${successfulUploads} PDF(s) uploaded. ${skippedFiles.length > 0 ? skippedFiles.length + ' non-PDFs skipped.' : ''}`);
      } else if (skippedFiles.length > 0) {
        alert(`${successfulUploads} PDF(s) uploaded. ${skippedFiles.length} non-PDFs skipped.`);
      }

    } catch (error) {
      console.error('Error during file upload batch processing:', error);
      alert('An unexpected error occurred during file upload.');
    } finally {
      if (selectedClassId !== null && successfullyAddedCount > 0) {
        await refreshData();
      }
      setIsProcessing(false);
    }
  };

  const handleStatusChange = async (id: number, newStatus: 'to-study' | 'done') => {
    setIsProcessing(true);
    try {
      setPdfs(prevPdfs => prevPdfs.map(p => p.id === id ? { ...p, status: newStatus } : p));
      if (viewingPDF && viewingPDF.id === id) {
        setViewingPDF(prev => prev ? { ...prev, status: newStatus } : null);
      }
      await updatePDFStatus(id, newStatus);
      await refreshData(true);
    } catch (error) {
      console.error('Error updating PDF status:', error);
      await refreshData(true);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeletePDF = async (id: number) => {
    setIsProcessing(true);
    try {
      setPdfs(prevPdfs => prevPdfs.filter(p => p.id !== id));
      if (viewingPDF && viewingPDF.id === id) {
        setViewingPDF(null);
      }
      await deletePDF(id);
      await refreshData(true);
    } catch (error) {
      console.error('Error deleting PDF:', error);
      await refreshData(true);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSelectClass = (classId: string) => { // Changed
    setActiveTab('to-study');
    if (selectedClassId !== classId) {
      setSelectedClassId(classId);
    } else if (!selectedClass && isDBInitialized) {
      refreshData();
    }
  };

  const handleBackToClasses = () => {
    setSelectedClassId(null);
    setViewingPDF(null);
  };

  const handleCreateAndSelectClass = (classId: string) => { // Changed
    setActiveTab('to-study');
    setSelectedClassId(classId);
  };

  const handleViewPDF = (pdf: PDF) => {
    setViewingPDF(pdf);
  };

  const handleClosePDFViewer = () => {
    setViewingPDF(null);
  };

  const saveNotesToDB = useCallback(async (classId: string, notesToSave: string) => { // Changed classId type
    try {
      await updateClass(classId, { notes: notesToSave });
      console.log("Notes saved for class ID:", classId);
    } catch (error) {
      console.error('Failed to save class notes to DB:', error);
    }
  }, []);

  const handleClassNotesChange = useCallback((newNotes: string) => {
    if (selectedClass && selectedClass.id === currentSelectedClassIdRef.current) { // currentSelectedClassIdRef.current is string
      setSelectedClass(prevClass => {
        if (prevClass && prevClass.id === currentSelectedClassIdRef.current) {
          return { ...prevClass, notes: newNotes };
        }
        return prevClass;
      });
    }

    if (notesUpdateDebounceTimeoutRef.current) {
      clearTimeout(notesUpdateDebounceTimeoutRef.current);
    }

    notesUpdateDebounceTimeoutRef.current = setTimeout(() => {
      if (currentSelectedClassIdRef.current !== null) { // currentSelectedClassIdRef.current is string
        saveNotesToDB(currentSelectedClassIdRef.current, newNotes);
      }
    }, 750);
  }, [saveNotesToDB, selectedClass]);

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

    const finalUpdates = uniqueCombinedPdfs.map((pdf, index) => ({ id: pdf.id!, orderIndex: index }));

    setIsProcessing(true);
    try {
      setPdfs(uniqueCombinedPdfs.map(p => ({...p, orderIndex: finalUpdates.find(u => u.id === p.id)?.orderIndex ?? p.orderIndex })));
      await updateMultiplePDFOrders(finalUpdates);
      await refreshData(true);
    } catch (error) {
      console.error('Error updating PDF order:', error);
      await refreshData(true);
    } finally {
      setIsProcessing(false);
    }
  };

  const toStudyPDFs = pdfs.filter(pdf => pdf.status === 'to-study');
  const donePDFs = pdfs.filter(pdf => pdf.status === 'done');

  const statsData = {
    total: selectedClass?.pdfCount || 0,
    toStudy: (selectedClass?.pdfCount || 0) - (selectedClass?.doneCount || 0),
    done: selectedClass?.doneCount || 0,
  };
  
  if (isDBInitializing) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-900 justify-center items-center">
        <LoadingSpinner />
        <p className="text-gray-400 mt-4">Initializing Application...</p>
      </div>
    );
  }

  if (dbError) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-900 justify-center items-center p-4 text-center">
        <h2 className="text-2xl text-red-400 mb-4">Database Error</h2>
        <p className="text-gray-300 mb-2">Could not initialize the application database.</p>
        <p className="text-gray-400 text-sm">{dbError.message}</p>
        <p className="text-gray-400 text-sm mt-4">Please try refreshing the page.</p>
      </div>
    );
  }

  if (selectedClassId === null || !isDBInitialized) {
    return <ClassManagement onSelectClass={handleSelectClass} onCreateClass={handleCreateAndSelectClass} />;
  }

  if (isLoadingClassData || (!selectedClass && !classDataError)) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-900 text-gray-200">
        <Header
          pageTitle={selectedClass?.name || "Loading Class..."}
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

  if (classDataError && !selectedClass) {
      return (
          <div className="flex flex-col min-h-screen bg-gray-900 text-gray-200">
              <Header
                  pageTitle="Error"
                  onBackClick={handleBackToClasses}
                  showBackButton={true}
              />
              <main className="flex-1 container mx-auto px-4 py-6 flex flex-col justify-center items-center">
                  <h2 className="text-2xl text-red-400 mb-4">Error Loading Class Data</h2>
                  <p className="text-gray-300 mb-4">{classDataError.message}</p>
                  <button
                      onClick={handleBackToClasses}
                      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                  >
                      Go to Class Management
                  </button>
              </main>
              <Footer />
          </div>
      );
  }
  
  if (!selectedClass) {
       return (
          <div className="flex flex-col min-h-screen bg-gray-900 justify-center items-center">
              <p className="text-gray-400">An unexpected error occurred loading class data. Please try again.</p>
              <button onClick={handleBackToClasses} className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">Go Back</button>
          </div>
      );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-900 text-gray-200">
      <Header
        pageTitle={selectedClass.name}
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
              
              {isProcessing && (activeTab !== 'notes' && pdfs.length === 0) ? (
                <LoadingSpinner />
              ) : (
                <>
                  {activeTab === 'notes' ? (
                    <div className="h-[500px]">
                      <textarea
                        value={selectedClass?.notes || ''}
                        onChange={(e) => handleClassNotesChange(e.target.value)}
                        placeholder="Class notes will appear here..."
                        className="w-full h-full p-3 bg-gray-900 text-gray-200 border border-gray-700 rounded-md resize-none focus:ring-2 focus:ring-green-400 focus:border-green-400 outline-none"
                        aria-label="Class notes editor"
                      />
                    </div>
                  ) : (
                    <PDFList
                      pdfs={activeTab === 'to-study' ? toStudyPDFs : donePDFs}
                      listType={activeTab as 'to-study' | 'done'}
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