import React, { useState, useEffect } from 'react';
import type { Class } from '../utils/types';
import { getClasses, deleteClass } from '../utils/db';
import ClassCreator from './ClassCreator';
import ClassList from './ClassList';
import ConfirmationModal from './ConfirmationModal';
import Footer from './Footer';

interface ClassManagementProps {
  onSelectClass: (classId: number) => void;
  onCreateClass: (classId: number) => void;
}

const ClassManagement: React.FC<ClassManagementProps> = ({ onSelectClass, onCreateClass }) => {
  const [classes, setClasses] = useState<Class[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; classId: number | null }>({
    isOpen: false,
    classId: null,
  });
  const [showOnlyPinned, setShowOnlyPinned] = useState(false);
  
  useEffect(() => {
    loadClasses();
  }, []);

  const loadClasses = async () => {
    setIsLoading(true);
    try {
      const classData = await getClasses();
      
      // Process class data with progress calculation
      const classesWithProgress = classData.map(cls => {
        const doneCount = cls.doneCount || 0;
        const totalItems = cls.pdfCount;
        const progress = totalItems > 0 ? Math.round((doneCount / totalItems) * 100) : 0;
        
        return {
          ...cls,
          progress,
          completedItems: doneCount,
          totalItems
        };
      });
      
      // Sort classes: pinned first, then by name
      const sortedClasses = classesWithProgress.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return a.name.localeCompare(b.name);
      });
      
      setClasses(sortedClasses);
    } catch (error) {
      console.error('Failed to load classes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmDelete = (classId: number) => {
    setConfirmDelete({ isOpen: true, classId });
  };

  const handleDeleteClass = async () => {
    if (confirmDelete.classId === null) return;
    
    try {
      await deleteClass(confirmDelete.classId);
      setConfirmDelete({ isOpen: false, classId: null });
      await loadClasses();
    } catch (error) {
      console.error('Failed to delete class:', error);
      setConfirmDelete({ isOpen: false, classId: null });
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
      {/* Add overflow-x-hidden to prevent horizontal scrollbar */}
      <div className="fixed inset-0 bg-gray-900 -z-10" aria-hidden="true"></div>
      <div className="bg-gray-800 py-8 mb-8">
        <div className="container mx-auto px-4">
          <h1 className="text-3xl font-bold text-center text-green-400">
            struct
          </h1>
        </div>
      </div>

      <div className="container mx-auto px-4 pb-16 flex-grow">
        <ClassCreator onClassCreated={loadClasses} onCreateClass={onCreateClass} />
        
        <ClassList 
          classes={filteredClasses}
          isLoading={isLoading}
          showOnlyPinned={showOnlyPinned}
          onTogglePinnedFilter={handleTogglePinnedFilter}
          onSelectClass={onSelectClass}
          onRequestDelete={handleConfirmDelete}
          onDataChanged={loadClasses}
        />
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