// src/components/ClassCreator.tsx
import React, { useState } from 'react';
import { addClass } from '../utils/db';
import type { Class } from '../utils/types';

interface ClassCreatorProps {
  onClassCreated: () => Promise<void>; 
  onCreateClass: (classId: number) => void; 
}

const ClassCreator: React.FC<ClassCreatorProps> = ({ onClassCreated, onCreateClass }) => {
  const [newClassName, setNewClassName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateClass = async() => {
    const trimmedName = newClassName.trim();
    if (!trimmedName || isCreating) {return;}
    
    setIsCreating(true);
    try {
      const classData: Omit<Class, 'id' | 'pdfCount' | 'doneCount' | 'progress' | 'completedItems' | 'totalItems' | 'notes'> = {
        name: trimmedName,
        dateCreated: Date.now(),
        isPinned: false, 
      };
      const classId = await addClass(classData); // addClass in db.ts initializes notes
      
      setNewClassName('');
      await onClassCreated(); 
      onCreateClass(classId); 
    } catch (error) {
      console.error('Failed to create class:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleCreateClass();
    }
  };

  return (
    <div className="mb-8">
      <h2 className="text-xl font-bold mb-4 text-gray-200">Create New Class</h2>
      <div className="flex">
        <input
          type="text"
          value={newClassName}
          onChange={(e) => setNewClassName(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Enter class name (e.g., Math 101)"
          className="flex-1 p-2 rounded-l bg-gray-800 border border-gray-700 text-gray-200 focus:ring-2 focus:ring-green-400 outline-none"
          disabled={isCreating}
          aria-label="New class name"
        />
        <button
          onClick={handleCreateClass}
          className="bg-green-500 text-white px-4 py-2 rounded-r hover:bg-green-600 transition-colors disabled:opacity-50"
          disabled={isCreating || !newClassName.trim()}
        >
          {isCreating ? 'Creating...' : 'Create'}
        </button>
      </div>
    </div>
  );
};

export default ClassCreator;