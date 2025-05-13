// src/hooks/useClassData.ts
import { useState, useEffect, useCallback } from 'react';
import { getClass, getClassPDFs } from '../utils/db';
import type { PDF, Class } from '../utils/types';

interface UseClassDataReturn {
  selectedClass: Class | null;
  setSelectedClass: React.Dispatch<React.SetStateAction<Class | null>>;
  pdfs: PDF[];
  setPdfs: React.Dispatch<React.SetStateAction<PDF[]>>;
  isLoadingClassData: boolean;
  classDataError: Error | null;
  refreshData: (keepLoadingState?: boolean) => Promise<void>;
}

// Accept classId as an argument
export function useClassData(isDBInitialized: boolean, classId: string | undefined | null): UseClassDataReturn {
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [pdfs, setPdfs] = useState<PDF[]>([]);
  const [isLoadingClassData, setIsLoadingClassData] = useState(false);
  const [classDataError, setClassDataError] = useState<Error | null>(null);

  const resetClassData = useCallback((error: Error | null = null) => {
    setSelectedClass(null);
    setPdfs([]);
    setIsLoadingClassData(false);
    setClassDataError(error);
  }, []);


  const refreshData = useCallback(async (keepLoadingState = false) => {
    if (!isDBInitialized) {
      console.log("Database not initialized, deferring class data refresh.");
      // Don't reset here, wait for DB init maybe
      return;
    }

    // If classId is not provided or empty string, reset and return
    if (!classId) {
      resetClassData();
      return;
    }

    if (!keepLoadingState) {
      setIsLoadingClassData(true);
    }
    setClassDataError(null); // Clear previous errors on refresh attempt

    try {
      const classData = await getClass(classId);

      if (classData) {
        setSelectedClass(classData);
        const classPDFs = await getClassPDFs(classId);
        setPdfs(classPDFs);
        setClassDataError(null); // Explicitly clear error on success
      } else {
        // Use resetClassData to set the error correctly
        resetClassData(new Error(`Class with ID ${classId} not found.`));
        console.warn(`Class with ID ${classId} not found during refresh.`);
      }
    } catch (err) {
      console.error(`Error loading data for class ID ${classId}:`, err);
      // Use resetClassData to set the error correctly
      resetClassData(err instanceof Error ? err : new Error(String(err)));
    } finally {
      if (!keepLoadingState) {
        setIsLoadingClassData(false);
      }
    }
  }, [classId, isDBInitialized, resetClassData]); // Added resetClassData dependency

  // Effect now depends on classId and isDBInitialized
  useEffect(() => {
    if (classId && isDBInitialized) {
      refreshData();
    } else {
      // Reset if classId becomes null/undefined or DB is not ready
      resetClassData();
    }
    // Disable eslint warning because refreshData depends on classId,
    // which is already in the dependency array. resetClassData is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, isDBInitialized, resetClassData]); // Added resetClassData dependency


  return {
    selectedClass,
    setSelectedClass,
    pdfs,
    setPdfs,
    isLoadingClassData,
    classDataError,
    refreshData
  };
}