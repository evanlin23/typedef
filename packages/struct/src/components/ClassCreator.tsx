import React, { useState } from 'react';
import { addClass } from '../utils/db';

interface ClassCreatorProps {
  onClassCreated: () => Promise<void>;
  onCreateClass: (classId: number) => void;
}

const ClassCreator: React.FC<ClassCreatorProps> = ({ onClassCreated, onCreateClass }) => {
  const [newClassName, setNewClassName] = useState('');

  const handleCreateClass = async () => {
    if (!newClassName.trim()) return;
    
    try {
      const classId = await addClass({
        name: newClassName.trim(),
        dateCreated: Date.now(),
        pdfCount: 0,
        isPinned: false
      });
      
      setNewClassName('');
      await onClassCreated();
      onCreateClass(classId);
    } catch (error) {
      console.error('Failed to create class:', error);
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
  );
};

export default ClassCreator;