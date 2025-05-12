// src/components/ClassManagement.tsx
import { useState, useEffect, useCallback } from 'react';
import type { Class } from '../utils/types';
import { getClasses, deleteClass as dbDeleteClass } from '../utils/db';
import ClassCreator from './ClassCreator';
import ClassList from './ClassList';
import ConfirmationModal from './ConfirmationModal';
import Footer from './Footer';
import Header from './Header';
import LoadingSpinner from './LoadingSpinner';

/**
 * Props for the ClassManagement component
 */
interface ClassManagementProps {
  /** Callback when a class is selected */
  onSelectClass: (classId: string) => void;
  /** Callback when a new class is created */
  onCreateClass: (classId: string) => void;
}

/**
 * Delete confirmation state interface
 */
interface DeleteConfirmationState {
  isOpen: boolean;
  classId: string | null;
}

/**
 * Component for managing classes, including creation, listing, and deletion
 */
const ClassManagement = ({ onSelectClass, onCreateClass }: ClassManagementProps) => {
  // State management
  const [classes, setClasses] = useState<Class[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeletingClass, setIsDeletingClass] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<DeleteConfirmationState>({
    isOpen: false,
    classId: null,
  });
  const [showOnlyPinned, setShowOnlyPinned] = useState(false);

  /**
   * Calculate progress for a class based on completed PDFs
   */
  const calculateClassProgress = (cls: Class): Class => {
    const doneCount = cls.doneCount || 0;
    const totalPdfs = cls.pdfCount || 0;
    const progress = totalPdfs > 0 ? Math.round((doneCount / totalPdfs) * 100) : 0;
    
    return {
      ...cls,
      progress,
      completedItems: doneCount,
      totalItems: totalPdfs,
    };
  };

  /**
   * Sort classes with pinned classes first, then alphabetically
   */
  const sortClasses = (classes: Class[]): Class[] => {
    return [...classes].sort((a, b) => {
      // Pinned classes come first
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      // Then sort alphabetically
      return a.name.localeCompare(b.name);
    });
  };

  /**
   * Load classes from the database, calculate progress, and sort them
   */
  const loadClasses = useCallback(async () => {
    setIsLoading(true);
    try {
      const classData = await getClasses();
      const processedClasses = sortClasses(
        classData.map(calculateClassProgress)
      );
      setClasses(processedClasses);
    } catch (error) {
      console.error('Failed to load classes:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load classes on component mount
  useEffect(() => {
    loadClasses();
  }, [loadClasses]);

  /**
   * Open the delete confirmation modal
   */
  const requestDeleteConfirmation = (classId: string) => {
    if (isDeletingClass) return;
    setConfirmDelete({ isOpen: true, classId });
  };

  /**
   * Handle class deletion after confirmation
   */
  const handleDeleteClass = async () => {
    if (confirmDelete.classId === null || isDeletingClass) return;
    
    setIsDeletingClass(true);

    try {
      await dbDeleteClass(confirmDelete.classId);
      setConfirmDelete({ isOpen: false, classId: null });
      await loadClasses();
    } catch (error) {
      console.error('[ClassManagement] Failed to delete class:', error);
      setConfirmDelete({ isOpen: false, classId: null });
      alert(`Failed to delete class: ${error instanceof Error ? error.message : String(error)}\nSee console for details.`);
    } finally {
      setIsDeletingClass(false);
    }
  };

  /**
   * Handle cancellation of class deletion
   */
  const handleCancelDelete = () => {
    if (isDeletingClass) return;
    setConfirmDelete({ isOpen: false, classId: null });
  };

  /**
   * Toggle the pinned filter
   */
  const handleTogglePinnedFilter = () => {
    setShowOnlyPinned(prev => !prev);
  };

  // Filter classes based on the pinned filter
  const filteredClasses = showOnlyPinned
    ? classes.filter(cls => cls.isPinned)
    : classes;

  return (
    <div className="bg-gray-900 text-gray-200 min-h-screen flex flex-col">
      <div className="fixed inset-0 bg-gray-900 -z-10" aria-hidden="true"></div>
      <Header showBackButton={false} />
      <div className="container mx-auto px-4 pb-16 flex-grow pt-8">
        <ClassCreator 
          onClassCreated={loadClasses} 
          onCreateClass={onCreateClass} 
        />
        {isLoading ? (
          <LoadingSpinner />
        ) : (
          <ClassList
            classes={filteredClasses}
            showOnlyPinned={showOnlyPinned}
            onTogglePinnedFilter={handleTogglePinnedFilter}
            onSelectClass={onSelectClass}
            onRequestDelete={requestDeleteConfirmation}
            onDataChanged={loadClasses}
          />
        )}
      </div>
      <Footer />
      <ConfirmationModal
        isOpen={confirmDelete.isOpen}
        title="Delete Class"
        message="Are you sure you want to delete this class? All PDFs associated with this class will also be deleted. This action cannot be undone."
        confirmText={isDeletingClass ? "Deleting..." : "Delete"}
        cancelText="Cancel"
        onConfirm={handleDeleteClass}
        onCancel={handleCancelDelete}
        isConfirmDisabled={isDeletingClass}
        isCancelDisabled={isDeletingClass}
        confirmButtonClass="bg-red-600 hover:bg-red-700"
      />
    </div>
  );
};

export default ClassManagement;