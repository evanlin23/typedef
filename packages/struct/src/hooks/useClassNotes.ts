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
    // Check against the ref for the most up-to-date ID associated with this hook instance
    if (selectedClass && selectedClass.id === currentSelectedClassIdRef.current) {
      setSelectedClass(prevClass => {
        // Double-check inside the updater function as well
        if (prevClass && prevClass.id === currentSelectedClassIdRef.current) {
          return { ...prevClass, notes: newNotes };
        }
        return prevClass; // Return previous state if class changed unexpectedly
      });
    } else if (selectedClass && selectedClass.id !== currentSelectedClassIdRef.current) {
      console.warn("useClassNotes: selectedClass.id does not match currentSelectedClassIdRef. Skipping local update.");
    }


    // Debounce the database update to avoid excessive writes
    if (notesUpdateDebounceTimeoutRef.current) {
      clearTimeout(notesUpdateDebounceTimeoutRef.current);
    }

    notesUpdateDebounceTimeoutRef.current = setTimeout(() => {
      // === Use typeof check for robustness ===
      if (typeof currentSelectedClassIdRef.current === 'string' && currentSelectedClassIdRef.current.length > 0) {
        saveNotesToDB(currentSelectedClassIdRef.current, newNotes);
      } else {
        console.warn("Skipping notes save: classId is not a valid string.", currentSelectedClassIdRef.current);
      }
    }, 750); // Debounce time (750ms)
  }, [saveNotesToDB, selectedClass, setSelectedClass]); // Dependencies

  return {
    handleClassNotesChange
  };
}