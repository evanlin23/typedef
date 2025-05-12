// src/App.tsx
import { useState } from 'react';
import type { PDF } from './utils/types';
import type { TabType } from './components/TabNavigation';

// Components
import Header from './components/Header';
import Footer from './components/Footer';
import ClassManagement from './components/ClassManagement';
import PDFViewer from './components/PDFViewer';
import ClassView from './components/ClassView';
import LoadingView from './components/LoadingView';
import ErrorView from './components/ErrorView';

// Hooks
import { useDBInitialization } from './hooks/useDBInitialization';
import { useClassData } from './hooks/useClassData';
import { usePDFOperations } from './hooks/usePDFOperations';
import { useClassNotes } from './hooks/useClassNotes';

function App() {
  // IMPORTANT: Declare all useState hooks first to maintain consistent order
  // UI state
  const [activeTab, setActiveTab] = useState<TabType>('to-study');
  const [viewingPDF, setViewingPDF] = useState<PDF | null>(null);
  
  // Database initialization - custom hook
  const { isDBInitialized, dbError, isInitializing: isDBInitializing } = useDBInitialization();
  
  // Class data management - custom hook
  const {
    selectedClassId, setSelectedClassId,
    selectedClass, setSelectedClass,
    pdfs, setPdfs,
    isLoadingClassData,
    classDataError,
    refreshData
  } = useClassData(isDBInitialized);

  // PDF operations - custom hook
  const {
    isProcessing,
    handleFileUpload,
    handleStatusChange,
    handleDeletePDF,
    handlePDFOrderChange
  } = usePDFOperations({
    selectedClassId,
    pdfs,
    setPdfs,
    viewingPDF,
    setViewingPDF,
    refreshData
  });

  // Class notes operations - custom hook
  const { handleClassNotesChange } = useClassNotes({
    selectedClass,
    setSelectedClass,
    selectedClassId
  });

  // Class selection handlers
  const handleSelectClass = (classId: string) => {
    setActiveTab('to-study');
    if (selectedClassId !== classId) {
      setSelectedClassId(classId);
    } else if (!selectedClass && isDBInitialized) {
      refreshData();
    }
  };

  const handleCreateAndSelectClass = (classId: string) => {
    setActiveTab('to-study');
    setSelectedClassId(classId);
  };

  const handleBackToClasses = () => {
    setSelectedClassId(null);
    setViewingPDF(null);
  };

  // PDF viewer handlers
  const handleViewPDF = (pdf: PDF) => {
    setViewingPDF(pdf);
  };

  const handleClosePDFViewer = () => {
    setViewingPDF(null);
  };

  // Render states based on application state
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

  if (selectedClassId === null || !isDBInitialized) {
    return (
      <ClassManagement 
        onSelectClass={handleSelectClass} 
        onCreateClass={handleCreateAndSelectClass} 
      />
    );
  }

  if (isLoadingClassData || (!selectedClass && !classDataError)) {
    return (
      <LoadingView
        pageTitle={selectedClass?.name || "Loading Class..."}
        onBackClick={handleBackToClasses}
        showBackButton={true}
        message="Loading class data..."
      />
    );
  }

  if (classDataError && !selectedClass) {
    return (
      <ErrorView
        title="Error Loading Class Data"
        message={classDataError.message}
        onBackClick={handleBackToClasses}
      />
    );
  }
  
  if (!selectedClass) {
    return (
      <ErrorView
        title="Unexpected Error"
        message="An unexpected error occurred loading class data. Please try again."
        onBackClick={handleBackToClasses}
        showHeader={false}
      />
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
        <ClassView
          selectedClass={selectedClass}
          pdfs={pdfs}
          activeTab={activeTab}
          isProcessing={isProcessing}
          onTabChange={setActiveTab}
          onFileUpload={handleFileUpload}
          onStatusChange={handleStatusChange}
          onDeletePDF={handleDeletePDF}
          onViewPDF={handleViewPDF}
          onPDFOrderChange={handlePDFOrderChange}
          onNotesChange={handleClassNotesChange}
        />
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