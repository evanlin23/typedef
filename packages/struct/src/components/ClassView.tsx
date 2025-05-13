// src/components/ClassView.tsx
import React from 'react';
import type { PDF, Class } from '../utils/types';
import FileUpload from './FileUpload';
import ProgressStats from './ProgressStats';
import PDFList from './PDFList'; // Ensure PDFList accepts classId
import LoadingSpinner from './LoadingSpinner';
import TabNavigation from './TabNavigation';
import type { TabType } from './TabNavigation';

interface ClassViewProps {
  selectedClass: Class; // Contains the ID
  pdfs: PDF[];
  activeTab: TabType;
  isProcessing: boolean;
  onTabChange: (tab: TabType) => void;
  onFileUpload: (files: FileList) => Promise<void>;
  onStatusChange: (id: number, newStatus: 'to-study' | 'done') => Promise<void>;
  onDeletePDF: (id: number) => Promise<void>;
  // onViewPDF prop is removed as navigation is handled internally by PDFList
  onPDFOrderChange: (orderedPDFs: PDF[]) => Promise<void>;
  onNotesChange: (notes: string) => void;
}

const ClassView: React.FC<ClassViewProps> = ({
  selectedClass, // Use selectedClass.id
  pdfs,
  activeTab,
  isProcessing,
  onTabChange,
  onFileUpload,
  onStatusChange,
  onDeletePDF,
  // onViewPDF prop removed
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
                  classId={selectedClass.id} // Pass selectedClass.id HERE
                  onStatusChange={onStatusChange}
                  onDelete={onDeletePDF}
                  // onViewPDF prop removed from here
                  onOrderChange={onPDFOrderChange}
                  // Add dummy onViewPDF if PDFList still requires it, otherwise remove from PDFList props
                  onViewPDF={() => {}} // Dummy prop if needed temporarily
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