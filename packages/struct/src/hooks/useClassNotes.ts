// src/hooks/useClassNotes.ts
import { useRef, useCallback, useEffect } from 'react';
import { updateClass } from '../utils/db';
import type { Class } from '../utils/types';

interface UseClassNotesProps {
  selectedClass: Class | null;
  setSelectedClass: React.Dispatch<React.SetStateAction<Class | null>>;
  selectedClassId: string | null;
}

export function useClassNotes({
  selectedClass,
  setSelectedClass,
  selectedClassId,
}: UseClassNotesProps) {
  const notesUpdateDebounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentSelectedClassIdRef = useRef<string | null>(null);

  // Keep reference up to date
  useEffect(() => {
    currentSelectedClassIdRef.current = selectedClassId;
  }, [selectedClassId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (notesUpdateDebounceTimeoutRef.current) {
        clearTimeout(notesUpdateDebounceTimeoutRef.current);
      }
    };
  }, []);

  const saveNotesToDB = useCallback(async (classId: string, notesToSave: string) => {
    try {
      await updateClass(classId, { notes: notesToSave });
      console.log("Notes saved for class ID:", classId);
    } catch (error) {
      console.error('Failed to save class notes to DB:', error);
    }
  }, []);

  const handleClassNotesChange = useCallback((newNotes: string) => {
    // Update local state immediately for better UX
    if (selectedClass && selectedClass.id === currentSelectedClassIdRef.current) {
      setSelectedClass(prevClass => {
        if (prevClass && prevClass.id === currentSelectedClassIdRef.current) {
          return { ...prevClass, notes: newNotes };
        }
        return prevClass;
      });
    }

    // Debounce the database update to avoid excessive writes
    if (notesUpdateDebounceTimeoutRef.current) {
      clearTimeout(notesUpdateDebounceTimeoutRef.current);
    }

    notesUpdateDebounceTimeoutRef.current = setTimeout(() => {
      if (currentSelectedClassIdRef.current !== null) {
        saveNotesToDB(currentSelectedClassIdRef.current, newNotes);
      }
    }, 750);
  }, [saveNotesToDB, selectedClass, setSelectedClass]);

  return {
    handleClassNotesChange
  };
}
