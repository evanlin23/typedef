// src/hooks/usePDFOperations.ts
import { useState, useCallback } from 'react';
import { addPDF, updatePDFStatus, deletePDF, updateMultiplePDFOrders } from '../utils/db';
import type { PDF } from '../utils/types';

interface UsePDFOperationsProps {
  selectedClassId: string | null;
  pdfs: PDF[];
  setPdfs: React.Dispatch<React.SetStateAction<PDF[]>>;
  viewingPDF: PDF | null;
  setViewingPDF: React.Dispatch<React.SetStateAction<PDF | null>>;
  refreshData: (keepLoadingState?: boolean) => Promise<void>;
}

interface UsePDFOperationsReturn {
  isProcessing: boolean;
  handleFileUpload: (files: FileList) => Promise<void>;
  handleStatusChange: (id: number, newStatus: 'to-study' | 'done') => Promise<void>;
  handleDeletePDF: (id: number) => Promise<void>;
  handlePDFOrderChange: (orderedPDFsInActiveTab: PDF[]) => Promise<void>;
}

export function usePDFOperations({
  selectedClassId,
  pdfs,
  setPdfs,
  viewingPDF,
  setViewingPDF,
  refreshData,
}: UsePDFOperationsProps): UsePDFOperationsReturn {
  // Always declare all useState hooks first, before any useCallback hooks
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileUpload = useCallback(async (files: FileList) => {
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
              classId: selectedClassId,
              orderIndex: pdfs.length,
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
  }, [selectedClassId, pdfs.length, refreshData]);

  const handleStatusChange = useCallback(async (id: number, newStatus: 'to-study' | 'done') => {
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
  }, [viewingPDF, setPdfs, setViewingPDF, refreshData]);

  const handleDeletePDF = useCallback(async (id: number) => {
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
  }, [viewingPDF, setPdfs, setViewingPDF, refreshData]);

  const handlePDFOrderChange = useCallback(async (orderedPDFsInActiveTab: PDF[]) => {
    if (!selectedClassId) return;
    
    const allCurrentPdfsForClass = [...pdfs];
    let combinedPdfs: PDF[];

    // Determine which PDFs are in the current tab vs. the other tab
    const isToStudyTab = orderedPDFsInActiveTab.some(p => p.status === 'to-study');
    
    if (isToStudyTab) {
      const donePdfs = allCurrentPdfsForClass.filter(p => 
        p.status === 'done' && !orderedPDFsInActiveTab.find(op => op.id === p.id)
      );
      combinedPdfs = [...orderedPDFsInActiveTab, ...donePdfs];
    } else {
      const toStudyPdfs = allCurrentPdfsForClass.filter(p => 
        p.status === 'to-study' && !orderedPDFsInActiveTab.find(op => op.id === p.id)
      );
      combinedPdfs = [...toStudyPdfs, ...orderedPDFsInActiveTab];
    }
    
    // Ensure no duplicates
    const uniqueCombinedPdfs = combinedPdfs.filter((pdf, index, self) =>
      pdf.id !== undefined && index === self.findIndex((p) => p.id === pdf.id)
    );

    // Create updates for the database
    const finalUpdates = uniqueCombinedPdfs.map((pdf, index) => ({ 
      id: pdf.id!, 
      orderIndex: index 
    }));

    setIsProcessing(true);
    try {
      // Update local state immediately for better UX
      setPdfs(uniqueCombinedPdfs.map(p => ({
        ...p, 
        orderIndex: finalUpdates.find(u => u.id === p.id)?.orderIndex ?? p.orderIndex 
      })));
      
      // Update database
      await updateMultiplePDFOrders(finalUpdates);
      await refreshData(true);
    } catch (error) {
      console.error('Error updating PDF order:', error);
      await refreshData(true);
    } finally {
      setIsProcessing(false);
    }
  }, [selectedClassId, pdfs, setPdfs, refreshData]);

  return {
    isProcessing,
    handleFileUpload,
    handleStatusChange,
    handleDeletePDF,
    handlePDFOrderChange
  };
}
