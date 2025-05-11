// src/components/ClassCard.tsx
import React, { useState, useEffect, useRef } from 'react';
import type { Class } from '../utils/types';
import { updateClass } from '../utils/db';
import PinIcon from './PinIcon';
import ProgressBar from './ProgressBar';

interface ClassCardProps {
  classData: Class;
  onSelect: () => void;
  onRequestDelete: (e: React.MouseEvent) => void;
  onDataChanged: () => Promise<void>; // To refresh the list of classes
}

const ClassCard: React.FC<ClassCardProps> = ({ 
  classData, 
  onSelect, 
  onRequestDelete,
  onDataChanged
}) => {
  const [editingName, setEditingName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString();
  };

  const handleTogglePin = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card selection
    if (!classData.id) return;
    try {
      await updateClass(classData.id, { isPinned: !classData.isPinned });
      await onDataChanged();
    } catch (error) {
      console.error('Failed to toggle pin status:', error);
    }
  };

  const startEditingClassName = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingName(classData.name);
  };

  const handleEditNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditingName(e.target.value);
  };

  const saveClassName = async () => {
    if (editingName !== null && editingName.trim() && editingName.trim() !== classData.name) {
      if (!classData.id) return;
      try {
        await updateClass(classData.id, { name: editingName.trim() });
        await onDataChanged();
      } catch (error) {
        console.error('Failed to update class name:', error);
      }
    }
    setEditingName(null);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      saveClassName();
    } else if (e.key === 'Escape') {
      setEditingName(null); // Revert to original name by closing editor
    }
  };

  useEffect(() => {
    if (editingName !== null && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select(); // Select all text when editing starts
    }
  }, [editingName]);


  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card selection
    onRequestDelete(e);
  };

  return (
    <div
      onClick={editingName === null ? onSelect : undefined} // Only allow select if not editing
      className={`bg-gray-800 p-6 rounded-lg shadow-lg transition-colors group
        ${editingName === null ? 'cursor-pointer hover:bg-gray-700' : ''}
        ${classData.isPinned ? 'border-l-4 border-green-400' : 'border-l-4 border-transparent'}`}
      role="button"
      tabIndex={editingName === null ? 0 : -1}
      onKeyDown={(e) => {
        if (editingName === null && (e.key === 'Enter' || e.key === ' ')) {
            onSelect();
        }
      }}
    >
      <div className="flex justify-between items-start mb-2">
        {editingName !== null ? (
          <input
            ref={inputRef}
            type="text"
            value={editingName}
            onChange={handleEditNameChange}
            onKeyDown={handleKeyDown}
            onBlur={saveClassName} // Save on blur
            className="text-xl font-bold bg-gray-700 text-gray-200 p-1 rounded w-full focus:ring-2 focus:ring-green-400 outline-none"
            onClick={(e) => e.stopPropagation()} // Prevent card click through
            aria-label="Edit class name"
          />
        ) : (
          <div className="flex items-center space-x-2 min-w-0 flex-1"> {/* min-w-0 for truncation */}
            <h3 className="text-xl font-bold text-gray-200 truncate" title={classData.name}>
              {classData.name}
            </h3>
            <button
              onClick={startEditingClassName}
              className="ml-2 text-gray-400 hover:text-green-400 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
              aria-label="Edit class name"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
          </div>
        )}
        
        <div className="flex items-center space-x-1">
            <button
                onClick={handleTogglePin}
                className={`p-1 rounded transition-colors ${classData.isPinned ? 'text-green-400 hover:text-green-300' : 'text-gray-400 hover:text-green-400 opacity-0 group-hover:opacity-100 focus:opacity-100'}`}
                aria-label={classData.isPinned ? "Unpin class" : "Pin class"}
                title={classData.isPinned ? "Unpin class" : "Pin class"}
            >
                <PinIcon isPinned={classData.isPinned || false} />
            </button>
            <button
                onClick={handleDeleteClick}
                className="p-1 text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                aria-label="Delete class"
                title="Delete class"
            >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
            </button>
        </div>
      </div>
      
      <div className="text-sm text-gray-400">
        Created: {formatDate(classData.dateCreated)}
      </div>
      
      <div className="mt-1 text-sm text-gray-400">
        {classData.totalItems || 0} { (classData.totalItems || 0) === 1 ? 'PDF' : 'PDFs'}
      </div>
      
      <ProgressBar 
        progress={classData.progress || 0}
        completedItems={classData.completedItems || 0}
        totalItems={classData.totalItems || 0}
      />
    </div>
  );
};

export default ClassCard;