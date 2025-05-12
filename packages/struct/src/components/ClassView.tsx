// src/components/ClassView.tsx
import React from 'react';
import type { PDF, Class } from '../utils/types';
import FileUpload from './FileUpload';
import ProgressStats from './ProgressStats';
import PDFList from './PDFList';
import LoadingSpinner from './LoadingSpinner';
import TabNavigation from './TabNavigation';
import type { TabType } from './TabNavigation';

interface ClassViewProps {
  selectedClass: Class;
  pdfs: PDF[];
  activeTab: TabType;
  isProcessing: boolean;
  onTabChange: (tab: TabType) => void;
  onFileUpload: (files: FileList) => Promise<void>;
  onStatusChange: (id: number, newStatus: 'to-study' | 'done') => Promise<void>;
  onDeletePDF: (id: number) => Promise<void>;
  onViewPDF: (pdf: PDF) => void;
  onPDFOrderChange: (orderedPDFs: PDF[]) => Promise<void>;
  onNotesChange: (notes: string) => void;
}

const ClassView: React.FC<ClassViewProps> = ({
  selectedClass,
  pdfs,
  activeTab,
  isProcessing,
  onTabChange,
  onFileUpload,
  onStatusChange,
  onDeletePDF,
  onViewPDF,
  onPDFOrderChange,
  onNotesChange,
}) => {
  const toStudyPDFs = pdfs.filter(pdf => pdf.status === 'to-study');
  const donePDFs = pdfs.filter(pdf => pdf.status === 'done');
  
  const statsData = {
    total: selectedClass?.pdfCount || 0,
    toStudy: (selectedClass?.pdfCount || 0) - (selectedClass?.doneCount || 0),
    done: selectedClass?.doneCount || 0,
  };

  return (
    <div className="flex flex-col md:flex-row md:space-x-6">
      <div className="w-full md:w-1/3 mb-6 md:mb-0">
        <FileUpload onUpload={onFileUpload} />
        <ProgressStats stats={statsData} />
      </div>
      
      <div className="w-full md:w-2/3">
        <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
          <TabNavigation
            activeTab={activeTab}
            onTabChange={onTabChange}
            toStudyCount={toStudyPDFs.length}
            doneCount={donePDFs.length}
          />
          
          {isProcessing && (activeTab !== 'notes' && pdfs.length === 0) ? (
            <LoadingSpinner />
          ) : (
            <>
              {activeTab === 'notes' ? (
                <div className="h-[500px]">
                  <textarea
                    value={selectedClass?.notes || ''}
                    onChange={(e) => onNotesChange(e.target.value)}
                    placeholder="Class notes will appear here..."
                    className="w-full h-full p-3 bg-gray-900 text-gray-200 border border-gray-700 rounded-md resize-none focus:ring-2 focus:ring-green-400 focus:border-green-400 outline-none"
                    aria-label="Class notes editor"
                  />
                </div>
              ) : (
                <PDFList
                  pdfs={activeTab === 'to-study' ? toStudyPDFs : donePDFs}
                  listType={activeTab as 'to-study' | 'done'}
                  onStatusChange={onStatusChange}
                  onDelete={onDeletePDF}
                  onViewPDF={onViewPDF}
                  onOrderChange={onPDFOrderChange}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClassView;
