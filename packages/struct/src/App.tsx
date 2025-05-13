// Original path: App.tsx
// Original path: App.tsx
// src/App.tsx
import { Routes, Route, useParams, useNavigate, Outlet } from 'react-router-dom';
import { useState, useEffect } from 'react';
import type { PDF, Class } from './utils/types';
import type { TabType } from './components/TabNavigation';

// Components
import Header from './components/Header';
import Footer from './components/Footer';
import ClassManagement from './components/ClassManagement';
import PDFViewer from './components/PDFViewer';
import ClassView from './components/ClassView';
import LoadingView from './components/LoadingView';
import ErrorView from './components/ErrorView';
import NotFoundView from './components/NotFoundView';

// Hooks & Utils
import { useDBInitialization } from './hooks/useDBInitialization';
import { useClassData } from './hooks/useClassData';
import { usePDFOperations } from './hooks/usePDFOperations';
import { useClassNotes } from './hooks/useClassNotes';
import { getPDF, getClass } from './utils/db';

// --- Wrapper Components ---

// Wrapper for ClassManagement to handle navigation logic implicitly
export const ClassManagementWrapper = () => {
  const navigate = useNavigate();
  const handleSelectClass = (classId: string) => navigate(`/classes/${classId}`);
  const handleCreateAndSelectClass = (classId: string) => navigate(`/classes/${classId}`);

  return (
    <ClassManagement
      onSelectClass={handleSelectClass}
      onCreateClass={handleCreateAndSelectClass}
    />
  );
};


// Wrapper for ClassView to fetch data based on route params
export const ClassViewWrapper = () => {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const { isDBInitialized } = useDBInitialization();

  // State specifically for this view's interaction logic
  const [activeTab, setActiveTab] = useState<TabType>('to-study');

  // Fetch class data using the hook, now driven by the route param
  const {
    selectedClass, setSelectedClass,
    pdfs, setPdfs,
    isLoadingClassData,
    classDataError,
    refreshData
  } = useClassData(isDBInitialized, classId);

  // PDF Operations Hook
  const {
    isProcessing,
    handleFileUpload,
    handleStatusChange,
    handleDeletePDF,
    handlePDFOrderChange
  } = usePDFOperations({
    selectedClassId: classId || null,
    pdfs,
    setPdfs,
    viewingPDF: null, // Viewing PDF is now handled by a separate route
    setViewingPDF: () => {}, // No longer managed here
    refreshData
  });

  // Class Notes Hook
  const { handleClassNotesChange } = useClassNotes({
    selectedClass,
    setSelectedClass,
    selectedClassId: classId || null
  });

  // Handle back navigation from Header
  const handleBackToClasses = () => navigate('/classes');

  // --- Render Logic based on Data Fetching ---
  if (isLoadingClassData) {
    return (
      <LoadingView
        pageTitle="Loading Class..."
        onBackClick={handleBackToClasses}
        showBackButton={true}
        message="Loading class data..."
      />
    );
  }

  if (classDataError) {
    return (
      <ErrorView
        title="Error Loading Class Data"
        message={classDataError.message}
        onBackClick={handleBackToClasses} // Navigate back to the list
      />
    );
  }

  if (!selectedClass) {
    // This case might indicate classId is invalid or data fetching failed unexpectedly
    return <NotFoundView type="Class" id={classId} onBackClick={handleBackToClasses} />;
  }

  // --- Render the Actual Class View ---
  // Ensure selectedClass is non-null before rendering ClassView
  return (
    <div className="flex flex-col min-h-screen bg-gray-900 text-gray-200">
      <Header
        pageTitle={selectedClass.name}
        onBackClick={handleBackToClasses}
        showBackButton={true}
      />
      <main className="flex-1 container mx-auto px-4 py-6">
        <ClassView
          selectedClass={selectedClass} // Pass the non-null selectedClass
          pdfs={pdfs}
          activeTab={activeTab}
          isProcessing={isProcessing}
          onTabChange={setActiveTab}
          onFileUpload={handleFileUpload}
          onStatusChange={handleStatusChange}
          onDeletePDF={handleDeletePDF}
          // onViewPDF is removed as navigation happens inside PDFList
          onPDFOrderChange={handlePDFOrderChange}
          onNotesChange={handleClassNotesChange}
        />
      </main>
      <Footer />
      {/* PDF Viewer is now rendered via its own route */}
      <Outlet /> {/* For potential nested routes if needed later */}
    </div>
  );
};

// Wrapper for PDFViewer to fetch data and handle close
export const PDFViewerWrapper = () => {
  const { classId, pdfId } = useParams<{ classId: string, pdfId: string }>();
  const navigate = useNavigate();
  const { isDBInitialized } = useDBInitialization();

  const [pdfData, setPdfData] = useState<PDF | null>(null);
  const [classData, setClassData] = useState<Class | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const pdfIdNum = pdfId ? parseInt(pdfId, 10) : NaN;

  // Fetch PDF and Class data
  useEffect(() => {
    // Capture stable values for this effect run
    const currentClassId = classId;
    const currentPdfIdNum = pdfIdNum;

    // Reset state when IDs change or DB status changes before fetching
    setIsLoading(true);
    setError(null);
    setPdfData(null);
    setClassData(null);

    if (!isDBInitialized) {
      console.log("PDFViewerWrapper: DB not initialized, waiting...");
      setIsLoading(false); // Set loading false if waiting for DB
      return;
    }

    // === Robust check for valid IDs ===
    if (typeof currentClassId !== 'string' || !currentClassId || isNaN(currentPdfIdNum)) {
      console.error("PDFViewerWrapper: Invalid parameters received.", { currentClassId, currentPdfIdNum });
      setError(new Error(`Invalid Class ID ('${currentClassId}') or PDF ID ('${pdfId}').`));
      setIsLoading(false);
      return;
    }

    // --- Fetch Data ---
    let isMounted = true; // Prevent state updates after unmount

    const fetchData = async () => {
      console.log(`PDFViewerWrapper: Fetching data for class ${currentClassId}, PDF ${currentPdfIdNum}`);

      try {
        // We are now certain currentClassId is a valid string
        const fetchedClass = await getClass(currentClassId);
        if (!isMounted) return;
        if (!fetchedClass) throw new Error(`Class with ID ${currentClassId} not found.`);

        // We are now certain currentPdfIdNum is a valid number if it wasn't NaN earlier
        if (isNaN(currentPdfIdNum)) { // Should have been caught, but double check
          throw new Error(`Invalid PDF ID after initial parse: '${pdfId}'.`);
        }

        const fetchedPdf = await getPDF(currentPdfIdNum);
        if (!isMounted) return;
        if (!fetchedPdf) throw new Error(`PDF with ID ${currentPdfIdNum} not found.`);

        // Validate ownership
        if (fetchedPdf.classId !== currentClassId) {
          throw new Error(`PDF ${currentPdfIdNum} does not belong to class ${currentClassId}.`);
        }

        // Set data only if component is still mounted
        setPdfData(fetchedPdf);
        setClassData(fetchedClass);

      } catch (err: unknown) { // Catch unknown
        if (!isMounted) return;
        console.error("Error fetching data for PDF viewer:", err);
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchData();

    // Cleanup
    return () => {
      isMounted = false;
      console.log("PDFViewerWrapper: Cleanup effect for", { currentClassId, currentPdfIdNum });
    };
  }, [classId, pdfId, pdfIdNum, isDBInitialized]); // Dependencies


  // Hooks using classId (ensure they handle null/undefined gracefully)
  const { handleStatusChange: viewerHandleStatusChange } = usePDFOperations({
    selectedClassId: classId || null, // Pass potentially null value initially
    pdfs: pdfData ? [pdfData] : [],
    setPdfs: (updateFn) => {
      if (typeof updateFn === 'function') {
        setPdfData(prev => (prev ? updateFn([prev])[0] : null));
      } else {
        const updatedPdf = Array.isArray(updateFn) ? updateFn.find(p => p.id === pdfIdNum) : null;
        setPdfData(updatedPdf || null);
      }
    },
    viewingPDF: pdfData,
    setViewingPDF: setPdfData,
    refreshData: async () => {
      if (classId && !isNaN(pdfIdNum)) {
        const freshPdf = await getPDF(pdfIdNum);
        if (freshPdf) setPdfData(freshPdf);
        const freshClass = await getClass(classId);
        if (freshClass) setClassData(freshClass);
      }
    }
  });

  const { handleClassNotesChange: viewerHandleClassNotesChange } = useClassNotes({
    selectedClass: classData,
    setSelectedClass: setClassData,
    selectedClassId: classId || null, // Pass potentially null value initially
  });

  // Navigation handler for closing the viewer
  const handleCloseViewer = () => navigate(`/classes/${classId}`);


  // --- Render Logic ---
  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex flex-col backdrop-blur-sm">
        <LoadingView message="Loading PDF..." showHeader={false}/>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex flex-col backdrop-blur-sm">
        <ErrorView
          title="Error Loading PDF"
          message={error.message}
          onBackClick={() => navigate(`/classes/${classId || ''}`)} // Navigate back, handle potentially null classId defensively
          showHeader={false}
        />
      </div>
    );
  }

  if (!pdfData || !classData) {
    // If loading is done and data is still null, treat as not found
    return (
      <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex flex-col backdrop-blur-sm">
        <NotFoundView type="PDF or Class data" id={`${classId}/${pdfId}`} onBackClick={() => navigate(`/classes/${classId || ''}`)} />
      </div>
    );
  }

  // Render the actual viewer
  return (
    <PDFViewer
      pdf={pdfData}
      onClose={handleCloseViewer} // Use the navigation handler
      onStatusChange={viewerHandleStatusChange}
      classNotes={classData.notes || ''}
      onClassNotesChange={viewerHandleClassNotesChange}
    />
  );
};


// --- Main App Component ---
function App() {
  // Database initialization
  const { dbError, isInitializing: isDBInitializing } = useDBInitialization(); // Removed unused isDBInitialized

  // --- Initial Loading/Error States ---
  if (isDBInitializing) {
    return <LoadingView message="Initializing Application..." showHeader={false} />;
  }

  if (dbError) {
    return (
      <ErrorView
        title="Database Error"
        message={`Could not initialize the application database. ${dbError.message} Please try refreshing the page.`}
        onBackClick={() => window.location.reload()}
        showHeader={false}
      />
    );
  }

  // --- Render Routes ---
  return (
    <Routes>
      <Route path="/" element={<ClassManagementWrapper />} />
      <Route path="/classes" element={<ClassManagementWrapper />} />
      <Route path="/classes/:classId" element={<ClassViewWrapper />} />
      <Route path="/classes/:classId/pdf/:pdfId" element={<PDFViewerWrapper />} />
      <Route path="*" element={<NotFoundView type="Page" />} />
    </Routes>
  );
}

export default App;