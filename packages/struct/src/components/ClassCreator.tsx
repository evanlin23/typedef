// src/components/ClassCreator.tsx
import { useState, useCallback } from 'react';
import { addClass } from '../utils/db';
import type { Class } from '../utils/types';

/**
 * Props for the ClassCreator component
 */
interface ClassCreatorProps {
  /** Callback to refresh classes after creation */
  onClassCreated: () => Promise<void>;
  /** Callback with the ID of the newly created class */
  onCreateClass: (classId: string) => void;
}

/**
 * Component for creating new classes
 * Provides a form to enter class name and handles the creation process
 */
const ClassCreator = ({ onClassCreated, onCreateClass }: ClassCreatorProps) => {
  // State for the class name input field
  const [newClassName, setNewClassName] = useState('');
  // State to track when a class is being created
  const [isCreating, setIsCreating] = useState(false);

  /**
   * Creates a new class with the provided name
   */
  const handleCreateClass = useCallback(async () => {
    const trimmedName = newClassName.trim();
    // Prevent empty submissions or multiple submissions while creating
    if (!trimmedName || isCreating) return;

    setIsCreating(true);
    try {
      // Prepare class data for database
      const classDataForDb: Omit<Class, 'id' | 'pdfCount' | 'doneCount' | 'notes'> = {
        name: trimmedName,
        dateCreated: Date.now(),
        isPinned: false,
      };
      
      // Add class to database and get the new class ID
      const classId = await addClass(classDataForDb);

      // Reset form and notify parent components
      setNewClassName('');
      await onClassCreated();
      onCreateClass(classId);
    } catch (error) {
      console.error('Failed to create class:', error);
    } finally {
      setIsCreating(false);
    }
  }, [newClassName, isCreating, onClassCreated, onCreateClass]);

  /**
   * Handles Enter key press to submit the form
   */
  const handleKeyPress = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleCreateClass();
    }
  }, [handleCreateClass]);

  /**
   * Updates the class name state when input changes
   */
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setNewClassName(e.target.value);
  }, []);

  // Determine if the create button should be disabled
  const isCreateButtonDisabled = isCreating || !newClassName.trim();

  return (
    <div className="mb-8">
      <h2 className="text-xl font-bold mb-4 text-gray-200">Create New Class</h2>
      <div className="flex">
        <input
          type="text"
          value={newClassName}
          onChange={handleInputChange}
          onKeyPress={handleKeyPress}
          placeholder="Enter class name (e.g., Math 101)"
          className="flex-1 p-2 rounded-l bg-gray-800 border border-gray-700 text-gray-200 focus:ring-2 focus:ring-green-400 outline-none"
          disabled={isCreating}
          aria-label="New class name"
        />
        <button
          onClick={handleCreateClass}
          className="bg-green-500 text-white px-4 py-2 rounded-r hover:bg-green-600 transition-colors disabled:opacity-50"
          disabled={isCreateButtonDisabled}
          aria-busy={isCreating}
        >
          {isCreating ? 'Creating...' : 'Create'}
        </button>
      </div>
    </div>
  );
};

export default ClassCreator;