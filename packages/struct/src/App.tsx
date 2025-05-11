// src/App.tsx
import { useEffect, useState, useCallback } from 'react';
import { initDB, addPDF, updatePDFStatus, deletePDF, getClass, getClassPDFs } from './utils/db';
import Header from './components/Header';
import FileUpload from './components/FileUpload';
import PDFList from './components/PDFList';
import ProgressStats from './components/ProgressStats';
import ClassManagement from './components/ClassManagement';
import type { PDF, Class } from './utils/types';
import Footer from './components/Footer';
import LoadingSpinner from './components/LoadingSpinner'; // For initial load

function App() {
  const [pdfs, setPdfs] = useState<PDF[]>([]);
  const [isLoading, setIsLoading] = useState(true); // For general loading state, including DB init
  const [isDBInitialized, setIsDBInitialized] = useState(false);
  const [activeTab, setActiveTab] = useState<'to-study' | 'done'>('to-study');
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);

  // Initialize the database
  useEffect(() => {
    const setupDatabase = async() => {
      setIsLoading(true);
      try {
        await initDB();
        setIsDBInitialized(true);
      } catch (error) {
        console.error('Failed to initialize database:', error);
        // Optionally, set an error state to display a message to the user
      } finally {
        setIsLoading(false);
      }
    };
    setupDatabase();
  }, []);

  // Load class data and its PDFs, or refresh existing data
  const refreshData = useCallback(async() => {
    if (!isDBInitialized || selectedClassId === null) {
      setSelectedClass(null);
      setPdfs([]);
      return;
    }

    setIsLoading(true);
    try {
      const clsData = await getClass(selectedClassId);
      if (clsData) {
        setSelectedClass(clsData);
        const classPDFsData = await getClassPDFs(selectedClassId);
        setPdfs(classPDFsData);
      } else {
        // Class might have been deleted, handle appropriately
        setSelectedClass(null);
        setPdfs([]);
        setSelectedClassId(null); // Go back to class management
        console.warn(`Class with ID ${selectedClassId} not found during refresh.`);
      }
    } catch (error) {
      console.error('Error loading class data and PDFs:', error);
      setSelectedClass(null);
      setPdfs([]);
      // Optionally, show an error notification
    } finally {
      setIsLoading(false);
    }
  }, [selectedClassId, isDBInitialized]);

  // Effect to load data when selectedClassId changes
  useEffect(() => {
    if (isDBInitialized) {
      refreshData();
    }
  }, [selectedClassId, refreshData, isDBInitialized]);


  const handleFileUpload = async(files: FileList) => {
    if (selectedClassId === null) {
      alert('Please select a class before uploading files.');
      return;
    }
    
    setIsLoading(true); // Indicate loading for uploads
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type === 'application/pdf') {
          const arrayBuffer = await file.arrayBuffer();
          const pdfData: Omit<PDF, 'id'> = { // Omit 'id' as it's auto-generated
            name: file.name,
            size: file.size,
            lastModified: file.lastModified,
            data: arrayBuffer,
            status: 'to-study',
            dateAdded: Date.now(),
            classId: selectedClassId,
          };
          await addPDF(pdfData);
        } else {
          console.warn(`File ${file.name} is not a PDF and was skipped.`);
        }
      }
      await refreshData(); // Refresh data after all uploads
    } catch (error) {
      console.error('Error during file upload:', error);
      // Optionally, show an error notification
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async(id: number, newStatus: 'to-study' | 'done') => {
    try {
      await updatePDFStatus(id, newStatus);
      await refreshData();
    } catch (error) {
      console.error('Error updating PDF status:', error);
    }
  };

  const handleDeletePDF = async(id: number) => {
    try {
      await deletePDF(id);
      await refreshData();
    } catch (error) {
      console.error('Error deleting PDF:', error);
    }
  };

  const handleSelectClass = (classId: number) => {
    setActiveTab('to-study'); // Reset to 'to-study' tab when a new class is opened
    setSelectedClassId(classId);
  };

  const handleBackToClasses = () => {
    setSelectedClassId(null);
    setSelectedClass(null);
    setPdfs([]);
  };

  // Handles selecting a newly created class
  const handleCreateAndSelectClass = (classId: number) => {
    setActiveTab('to-study');
    setSelectedClassId(classId); // This will trigger the useEffect to load the new class's data
  };

  const toStudyPDFs = pdfs.filter(pdf => pdf.status === 'to-study');
  const donePDFs = pdfs.filter(pdf => pdf.status === 'done');

  // ProgressStats can derive its data from selectedClass if it's kept up-to-date
  const statsData = {
    total: selectedClass?.pdfCount || 0,
    toStudy: (selectedClass?.pdfCount || 0) - (selectedClass?.doneCount || 0),
    done: selectedClass?.doneCount || 0,
  };
  
  if (!isDBInitialized && isLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-900 justify-center items-center">
        <LoadingSpinner />
        <p className="text-gray-400 mt-4">Initializing Application...</p>
      </div>
    );
  }


  if (selectedClassId === null || !selectedClass) {
    return <ClassManagement onSelectClass={handleSelectClass} onCreateClass={handleCreateAndSelectClass} />;
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-900 text-gray-200">
      <Header 
        className={selectedClass?.name || ''} 
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
              </div>
              
              {isLoading ? (
                <LoadingSpinner />
              ) : (
                <PDFList
                  pdfs={activeTab === 'to-study' ? toStudyPDFs : donePDFs}
                  listType={activeTab}
                  onStatusChange={handleStatusChange}
                  onDelete={handleDeletePDF}
                />
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default App;