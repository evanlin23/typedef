// src/components/ClassManagement.tsx
import React, { useState, useEffect, useCallback } from 'react';
import type { Class } from '../utils/types';
import { getClasses, deleteClass as dbDeleteClass } from '../utils/db';
import ClassCreator from './ClassCreator';
import ClassList from './ClassList';
import ConfirmationModal from './ConfirmationModal';
import Footer from './Footer';
import Header from './Header';
import LoadingSpinner from './LoadingSpinner';

interface ClassManagementProps {
  onSelectClass: (classId: string) => void;
  onCreateClass: (classId: string) => void;
}

const ClassManagement: React.FC<ClassManagementProps> = ({ onSelectClass, onCreateClass }) => {
  const [classes, setClasses] = useState<Class[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeletingClass, setIsDeletingClass] = useState(false); // For delete operation
  const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; classId: string | null }>({
    isOpen: false,
    classId: null,
  });
  const [showOnlyPinned, setShowOnlyPinned] = useState(false);

  const loadClasses = useCallback(async () => {
    setIsLoading(true);
    try {
      const classData = await getClasses();
      const classesWithCalculatedProgress = classData.map(cls => {
        const doneCount = cls.doneCount || 0;
        const totalPdfs = cls.pdfCount || 0;
        const progress = totalPdfs > 0 ? Math.round((doneCount / totalPdfs) * 100) : 0;
        return {
          ...cls,
          progress,
          completedItems: doneCount,
          totalItems: totalPdfs,
        };
      });
      const sortedClasses = classesWithCalculatedProgress.sort((a, b) => {
        if (a.isPinned && !b.isPinned) { return -1; }
        if (!a.isPinned && b.isPinned) { return 1; }
        return a.name.localeCompare(b.name);
      });
      setClasses(sortedClasses);
    } catch (error) {
      console.error('Failed to load classes:', error);
      // Optionally set an error state for UI
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClasses();
  }, [loadClasses]);

  const requestDeleteConfirmation = (classId: string) => {
    if (isDeletingClass) return; // Prevent opening new modal if one delete is in progress
    setConfirmDelete({ isOpen: true, classId });
  };

  const handleDeleteClass = async () => {
    if (confirmDelete.classId === null || isDeletingClass) {
      return;
    }
    
    // console.log(`[ClassManagement] handleDeleteClass called for ID: ${confirmDelete.classId}`);
    setIsDeletingClass(true);

    try {
      await dbDeleteClass(confirmDelete.classId);
      // console.log(`[ClassManagement] Class ${confirmDelete.classId} deleted successfully from DB.`);
      // State updates will be batched by React
      setConfirmDelete({ isOpen: false, classId: null }); 
      await loadClasses(); // Refresh list
      // console.log(`[ClassManagement] Classes reloaded after deletion.`);
    } catch (error) {
      console.error('[ClassManagement] Failed to delete class:', error);
      setConfirmDelete({ isOpen: false, classId: null }); // Still close modal on error
      alert(`Failed to delete class: ${error instanceof Error ? error.message : String(error)}\nSee console for details.`);
    } finally {
      setIsDeletingClass(false);
    }
  };

  const handleCancelDelete = () => {
    if (isDeletingClass) return; // Don't allow cancel if deletion is mid-flight
    setConfirmDelete({ isOpen: false, classId: null });
  };

  const handleTogglePinnedFilter = () => {
    setShowOnlyPinned(prev => !prev);
  };

  const filteredClasses = showOnlyPinned
    ? classes.filter(cls => cls.isPinned)
    : classes;

  return (
    <div className="bg-gray-900 text-gray-200 min-h-screen flex flex-col">
      <div className="fixed inset-0 bg-gray-900 -z-10" aria-hidden="true"></div>
      <Header showBackButton={false} />
      <div className="container mx-auto px-4 pb-16 flex-grow pt-8">
        <ClassCreator onClassCreated={loadClasses} onCreateClass={onCreateClass} />
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
        isConfirmDisabled={isDeletingClass} // Pass disabled state to modal
        isCancelDisabled={isDeletingClass}  // Optionally disable cancel too
        confirmButtonClass="bg-red-600 hover:bg-red-700" // Base class, disabled styles handled by modal
      />
    </div>
  );
};

export default ClassManagement;