import { useEffect, useState } from 'react'
import { initDB, addPDF, updatePDFStatus, deletePDF, getClass, getClassPDFs } from './utils/db'
import Header from './components/Header'
import FileUpload from './components/FileUpload'
import PDFList from './components/PDFList'
import ProgressStats from './components/ProgressStats'
import ClassManagement from './components/ClassManagement'
import type { PDF, Class } from './utils/types'
import Footer from './components/Footer'

function App() {
  const [pdfs, setPdfs] = useState<PDF[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'to-study' | 'done'>('to-study');
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);

  // Initialize the database
  useEffect(() => {
    const setupDatabase = async () => {
      await initDB();
      setIsLoading(false);
    };
    
    setupDatabase();
  }, []);

  // Load class data and PDFs when class is selected
  useEffect(() => {
    const loadClassAndPDFs = async () => {
      if (selectedClassId !== null) {
        setIsLoading(true);
        try {
          const cls = await getClass(selectedClassId);
          setSelectedClass(cls);
          await loadPDFs();
        } catch (error) {
          console.error('Error loading data:', error);
        } finally {
          setIsLoading(false);
        }
      }
    };
    loadClassAndPDFs();
  }, [selectedClassId]);

  const loadPDFs = async () => {
    setIsLoading(true);
    
    try {
      if (selectedClassId === null) {
        setPdfs([]);
      } else {
        const classPDFs = await getClassPDFs(selectedClassId);
        setPdfs(classPDFs);
      }
    } catch (error) {
      console.error('Failed to load PDFs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (files: FileList) => {
    if (selectedClassId === null) return;
    
    setIsLoading(true);
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type === 'application/pdf') {
        const arrayBuffer = await file.arrayBuffer();
        
        const pdfData: PDF = {
          name: file.name,
          size: file.size,
          lastModified: file.lastModified,
          data: arrayBuffer,
          status: 'to-study',
          dateAdded: Date.now(),
          classId: selectedClassId
        };
        
        await addPDF(pdfData);
      }
    }
    
    await loadPDFs();
    setIsLoading(false);
  };

  const handleStatusChange = async (id: number, newStatus: 'to-study' | 'done') => {
    await updatePDFStatus(id, newStatus);
    await loadPDFs();
  };

  const handleDelete = async (id: number) => {
    await deletePDF(id);
    await loadPDFs();
  };

  const handleSelectClass = (classId: number) => {
    setSelectedClassId(classId);
  };

  const handleBackToClasses = () => {
    setSelectedClassId(null);
    setPdfs([]);
  };

  // Handle creating and immediately selecting a new class
  const handleCreateClass = (classId: number) => {
    setSelectedClassId(classId);
  };

  const toStudyPDFs = pdfs.filter(pdf => pdf.status === 'to-study');
  const donePDFs = pdfs.filter(pdf => pdf.status === 'done');

  const statsData = {
    total: pdfs.length,
    toStudy: toStudyPDFs.length,
    done: donePDFs.length
  };

  if (selectedClassId === null) {
    return <ClassManagement onSelectClass={handleSelectClass} onCreateClass={handleCreateClass} />;
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-900">
      <Header 
        className={selectedClass?.name || ''} 
        onBackClick={handleBackToClasses} 
        showBackButton={true}
      />
      <main className="flex-1 container mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row md:space-x-6">
          <div className="w-full md:w-1/3 mb-6 md:mb-0">
            <FileUpload onUpload={handleFileUpload} />
            <ProgressStats stats={statsData} />
          </div>
          
          <div className="w-full md:w-2/3">
            <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
              <div className="flex mb-4 border-b border-gray-700">
                <button
                  className={`px-4 py-2 text-lg ${
                    activeTab === 'to-study'
                      ? 'text-green-400 border-b-2 border-green-400'
                      : 'text-gray-400'
                  }`}
                  onClick={() => setActiveTab('to-study')}
                >
                  To Study ({toStudyPDFs.length})
                </button>
                <button
                  className={`px-4 py-2 text-lg ${
                    activeTab === 'done'
                      ? 'text-green-400 border-b-2 border-green-400'
                      : 'text-gray-400'
                  }`}
                  onClick={() => setActiveTab('done')}
                >
                  Done ({donePDFs.length})
                </button>
              </div>
              
              {isLoading ? (
                <div className="flex justify-center items-center h-64">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-400"></div>
                </div>
              ) : (
                <PDFList
                  pdfs={activeTab === 'to-study' ? toStudyPDFs : donePDFs}
                  onStatusChange={handleStatusChange}
                  onDelete={handleDelete}
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

export default App