import React, { useState, useEffect } from 'react';
import type { Class } from '../utils/types';
import { getClasses, addClass, deleteClass } from '../utils/db';

interface ClassManagementProps {
  onSelectClass: (classId: number) => void;
  onCreateClass: (classId: number) => void;
}

const ClassManagement: React.FC<ClassManagementProps> = ({ onSelectClass, onCreateClass }) => {
  const [classes, setClasses] = useState<Class[]>([]);
  const [newClassName, setNewClassName] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadClasses();
  }, []);

  const loadClasses = async () => {
    setIsLoading(true);
    try {
      const classData = await getClasses();
      setClasses(classData);
    } catch (error) {
      console.error('Failed to load classes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateClass = async () => {
    if (!newClassName.trim()) return;
    
    try {
      const classId = await addClass({
        name: newClassName.trim(),
        dateCreated: Date.now(),
        pdfCount: 0
      });
      
      setNewClassName('');
      await loadClasses();
      onCreateClass(classId);
    } catch (error) {
      console.error('Failed to create class:', error);
    }
  };

  const handleDeleteClass = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      await deleteClass(id);
      await loadClasses();
    } catch (error) {
      console.error('Failed to delete class:', error);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <div className="bg-gray-900 min-h-screen">
      <div className="bg-gray-800 py-8 mb-8">
        <div className="container mx-auto px-4">
          <h1 className="text-3xl font-bold text-center text-green-400">
            struct
          </h1>
        </div>
      </div>

      <div className="container mx-auto px-4">
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4 text-gray-200">Create New Class</h2>
          <div className="flex">
            <input
              type="text"
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              placeholder="Enter class name"
              className="flex-1 p-2 rounded-l bg-gray-800 border border-gray-700 text-gray-200"
              onKeyPress={(e) => e.key === 'Enter' && handleCreateClass()}
            />
            <button
              onClick={handleCreateClass}
              className="bg-green-500 text-white px-4 py-2 rounded-r hover:bg-green-600 transition-colors"
            >
              Create
            </button>
          </div>
        </div>

        <h2 className="text-xl font-bold mb-4 text-gray-200">Your Classes</h2>
        
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-400"></div>
          </div>
        ) : classes.length === 0 ? (
          <div className="text-center py-12 bg-gray-800 rounded-lg">
            <svg 
              className="mx-auto h-12 w-12 text-gray-400" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <path d="M12 20v-6M6 20V10M18 20V4"></path>
            </svg>
            <h3 className="mt-2 text-lg font-medium text-gray-200">No classes yet</h3>
            <p className="mt-1 text-gray-400">
              Create your first class to get started
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {classes.map((cls) => (
              <div
                key={cls.id}
                onClick={() => onSelectClass(cls.id!)}
                className="bg-gray-800 p-6 rounded-lg shadow-lg cursor-pointer hover:bg-gray-700 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <h3 className="text-xl font-bold text-gray-200 truncate">{cls.name}</h3>
                  <button
                    onClick={(e) => handleDeleteClass(cls.id!, e)}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <svg
                      className="h-5 w-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                  </button>
                </div>
                <div className="mt-2 text-gray-400 text-sm">
                  Created: {formatDate(cls.dateCreated)}
                </div>
                <div className="mt-1 text-gray-400 text-sm">
                  {cls.pdfCount} {cls.pdfCount === 1 ? 'PDF' : 'PDFs'}
                </div>
                <div className="mt-4">
                  <button className="w-full bg-blue-500 text-center py-2 rounded text-gray-200 hover:bg-blue-600 transition-colors">
                    Open Class
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ClassManagement;