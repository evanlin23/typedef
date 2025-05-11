// src/components/ClassManagement.tsx
import React, { useState, useEffect, useCallback } from 'react';
import type { Class } from '../utils/types';
import { getClasses, deleteClass as dbDeleteClass } from '../utils/db'; // Renamed to avoid conflict
import ClassCreator from './ClassCreator';
import ClassList from './ClassList';
import ConfirmationModal from './ConfirmationModal';
import Footer from './Footer';
import Header from './Header'; // Assuming a generic header might be wanted here too
import LoadingSpinner from './LoadingSpinner';

interface ClassManagementProps {
  onSelectClass: (classId: number) => void;
  onCreateClass: (classId: number) => void; // Used by ClassCreator to auto-select new class
}

const ClassManagement: React.FC<ClassManagementProps> = ({ onSelectClass, onCreateClass }) => {
  const [classes, setClasses] = useState<Class[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; classId: number | null }>({
    isOpen: false,
    classId: null,
  });
  const [showOnlyPinned, setShowOnlyPinned] = useState(false);
  
  const loadClasses = useCallback(async() => {
    setIsLoading(true);
    try {
      const classData = await getClasses();
      
      const classesWithCalculatedProgress = classData.map(cls => {
        const doneCount = cls.doneCount || 0;
        const totalPdfs = cls.pdfCount || 0; // pdfCount is the authoritative source from DB
        const progress = totalPdfs > 0 ? Math.round((doneCount / totalPdfs) * 100) : 0;
        
        return {
          ...cls,
          progress,
          completedItems: doneCount,
          totalItems: totalPdfs, // Use pdfCount from DB as totalItems
        };
      });
      
      // Sort classes: pinned first, then by name
      const sortedClasses = classesWithCalculatedProgress.sort((a, b) => {
        if (a.isPinned && !b.isPinned) {return -1;}
        if (!a.isPinned && b.isPinned) {return 1;}
        return a.name.localeCompare(b.name);
      });
      
      setClasses(sortedClasses);
    } catch (error) {
      console.error('Failed to load classes:', error);
      // Optionally, set an error state to display to the user
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClasses();
  }, [loadClasses]);

  const requestDeleteConfirmation = (classId: number) => {
    setConfirmDelete({ isOpen: true, classId });
  };

  const handleDeleteClass = async() => {
    if (confirmDelete.classId === null) {return;}
    
    try {
      await dbDeleteClass(confirmDelete.classId);
      setConfirmDelete({ isOpen: false, classId: null });
      await loadClasses(); // Refresh list after deletion
    } catch (error) {
      console.error('Failed to delete class:', error);
      setConfirmDelete({ isOpen: false, classId: null }); // Still close modal on error
      // Optionally, show an error notification
    }
  };

  const handleCancelDelete = () => {
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
      {/* Background div for consistent bg, good for overlays or complex layouts */}
      <div className="fixed inset-0 bg-gray-900 -z-10" aria-hidden="true"></div>
      
      {/* Using the standard Header component */}
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
            onDataChanged={loadClasses} // For ClassCard to trigger refresh
          />
        )}
      </div>

      <Footer />

      <ConfirmationModal
        isOpen={confirmDelete.isOpen}
        title="Delete Class"
        message="Are you sure you want to delete this class? All PDFs associated with this class will also be deleted. This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleDeleteClass}
        onCancel={handleCancelDelete}
      />
    </div>
  );
};

export default ClassManagement;