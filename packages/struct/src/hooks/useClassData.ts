// src/hooks/useClassData.ts
import { useState, useEffect, useCallback } from 'react';
import { getClass, getClassPDFs } from '../utils/db';
import type { PDF, Class } from '../utils/types';

interface UseClassDataReturn {
  selectedClassId: string | null; // Changed
  setSelectedClassId: React.Dispatch<React.SetStateAction<string | null>>; // Changed
  selectedClass: Class | null;
  setSelectedClass: React.Dispatch<React.SetStateAction<Class | null>>;
  pdfs: PDF[];
  setPdfs: React.Dispatch<React.SetStateAction<PDF[]>>;
  isLoadingClassData: boolean;
  classDataError: Error | null;
  refreshData: (keepLoadingState?: boolean) => Promise<void>;
}

export function useClassData(isDBInitialized: boolean): UseClassDataReturn {
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null); // Changed
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [pdfs, setPdfs] = useState<PDF[]>([]);
  const [isLoadingClassData, setIsLoadingClassData] = useState(false);
  const [classDataError, setClassDataError] = useState<Error | null>(null);

  const refreshData = useCallback(async (keepLoadingState = false) => {
    if (!isDBInitialized) {
      console.log("DB not initialized, refreshData for class deferred.");
      return;
    }
    if (selectedClassId === null) {
      setSelectedClass(null);
      setPdfs([]);
      setIsLoadingClassData(false);
      setClassDataError(null);
      return;
    }

    if (!keepLoadingState) {
      setIsLoadingClassData(true);
    }
    setClassDataError(null);

    try {
      const clsData = await getClass(selectedClassId); // selectedClassId is string
      if (clsData) {
        setSelectedClass(clsData);
        const classPDFsData = await getClassPDFs(selectedClassId); // selectedClassId is string
        setPdfs(classPDFsData);
      } else {
        console.warn(`Class with ID ${selectedClassId} not found. Clearing data.`);
        setSelectedClass(null);
        setPdfs([]);
        setClassDataError(new Error(`Class with ID ${selectedClassId} not found.`));
      }
    } catch (err) {
      console.error(`Error loading data for class ID ${selectedClassId}:`, err);
      setSelectedClass(null);
      setPdfs([]);
      setClassDataError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      if (!keepLoadingState) {
        setIsLoadingClassData(false);
      }
    }
  }, [selectedClassId, isDBInitialized]);

  useEffect(() => {
    if (selectedClassId !== null && isDBInitialized) {
        refreshData();
    } else if (selectedClassId === null) {
        setSelectedClass(null);
        setPdfs([]);
        setIsLoadingClassData(false);
        setClassDataError(null);
    }
  }, [selectedClassId, isDBInitialized, refreshData]);

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