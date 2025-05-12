// src/hooks/useClassData.ts
import { useState, useEffect, useCallback } from 'react';
import { getClass, getClassPDFs } from '../utils/db';
import type { PDF, Class } from '../utils/types';

/**
 * Return type for the useClassData hook
 */
interface UseClassDataReturn {
  /** Currently selected class ID or null if no class is selected */
  selectedClassId: string | null;
  /** Function to update the selected class ID */
  setSelectedClassId: React.Dispatch<React.SetStateAction<string | null>>;
  /** Currently selected class data or null if no class is selected */
  selectedClass: Class | null;
  /** Function to update the selected class data */
  setSelectedClass: React.Dispatch<React.SetStateAction<Class | null>>;
  /** PDFs associated with the selected class */
  pdfs: PDF[];
  /** Function to update the PDFs */
  setPdfs: React.Dispatch<React.SetStateAction<PDF[]>>;
  /** Whether class data is currently being loaded */
  isLoadingClassData: boolean;
  /** Error that occurred during class data loading, or null if no error */
  classDataError: Error | null;
  /** Function to refresh class data */
  refreshData: (keepLoadingState?: boolean) => Promise<void>;
}

/**
 * Hook for managing class data, including the selected class and its PDFs
 * @param isDBInitialized Whether the database has been initialized
 * @returns Object containing class data state and functions to manage it
 */
export function useClassData(isDBInitialized: boolean): UseClassDataReturn {
  // State for the selected class ID
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  // State for the selected class data
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  // State for the PDFs associated with the selected class
  const [pdfs, setPdfs] = useState<PDF[]>([]);
  // Loading state
  const [isLoadingClassData, setIsLoadingClassData] = useState(false);
  // Error state
  const [classDataError, setClassDataError] = useState<Error | null>(null);

  /**
   * Refreshes class data from the database
   * @param keepLoadingState If true, doesn't update loading state (useful for background refreshes)
   */
  const refreshData = useCallback(async (keepLoadingState = false) => {
    // Skip if database isn't initialized
    if (!isDBInitialized) {
      console.log("Database not initialized, deferring class data refresh.");
      return;
    }
    
    // Clear data if no class is selected
    if (selectedClassId === null) {
      resetClassData();
      return;
    }

    // Update loading state if not keeping current state
    if (!keepLoadingState) {
      setIsLoadingClassData(true);
    }
    
    // Clear any previous errors
    setClassDataError(null);

    try {
      // Fetch class data
      const classData = await getClass(selectedClassId);
      
      if (classData) {
        // Update class data if found
        setSelectedClass(classData);
        
        // Fetch and update PDFs for this class
        const classPDFs = await getClassPDFs(selectedClassId);
        setPdfs(classPDFs);
      } else {
        // Handle case where class is not found
        console.warn(`Class with ID ${selectedClassId} not found. Clearing data.`);
        resetClassData(new Error(`Class with ID ${selectedClassId} not found.`));
      }
    } catch (err) {
      // Handle any errors during data fetching
      console.error(`Error loading data for class ID ${selectedClassId}:`, err);
      resetClassData(err instanceof Error ? err : new Error(String(err)));
    } finally {
      // Reset loading state if not keeping current state
      if (!keepLoadingState) {
        setIsLoadingClassData(false);
      }
    }
  }, [selectedClassId, isDBInitialized]);

  /**
   * Helper function to reset class data with an optional error
   */
  const resetClassData = useCallback((error: Error | null = null) => {
    setSelectedClass(null);
    setPdfs([]);
    setIsLoadingClassData(false);
    setClassDataError(error);
  }, []);

  // Effect to refresh data when selected class changes or DB initializes
  useEffect(() => {
    if (selectedClassId !== null && isDBInitialized) {
      refreshData();
    } else if (selectedClassId === null) {
      resetClassData();
    }
  }, [selectedClassId, isDBInitialized, refreshData, resetClassData]);

  return {
    selectedClassId,
    setSelectedClassId,
    selectedClass,
    setSelectedClass,
    pdfs,
    setPdfs,
    isLoadingClassData,
    classDataError,
    refreshData
  };
}