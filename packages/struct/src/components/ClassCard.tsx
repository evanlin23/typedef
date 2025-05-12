// src/components/ClassCard.tsx
import { useState, useEffect, useRef } from 'react';
import type { Class } from '../utils/types';
import { updateClass } from '../utils/db';
import PinIcon from './PinIcon';
import ProgressBar from './ProgressBar';

/**
 * Props for the ClassCard component
 */
interface ClassCardProps {
  /** Class data to display */
  classData: Class;
  /** Callback when the class is selected */
  onSelect: () => void;
  /** Callback when class deletion is requested */
  onRequestDelete: (e: React.MouseEvent) => void;
  /** Callback to refresh class data */
  onDataChanged: () => Promise<void>;
}

/**
 * Delete icon component
 */
const DeleteIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    <line x1="10" y1="11" x2="10" y2="17"></line>
    <line x1="14" y1="11" x2="14" y2="17"></line>
  </svg>
);

/**
 * Edit icon component
 */
const EditIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
  </svg>
);

/**
 * Formats a timestamp into a readable date string
 */
const formatDate = (timestamp: number): string => {
  return new Date(timestamp).toLocaleDateString();
};

/**
 * Component for displaying and interacting with a class card
 */
const ClassCard = ({ 
  classData, 
  onSelect, 
  onRequestDelete,
  onDataChanged
}: ClassCardProps) => {
  // State for tracking name editing
  const [editingName, setEditingName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /**
   * Toggle the pinned status of the class
   */
  const handleTogglePin = async (e: React.MouseEvent) => {
    e.stopPropagation(); 
    if (!classData.id) return;
    
    try {
      await updateClass(classData.id, { isPinned: !classData.isPinned });
      await onDataChanged();
    } catch (error) {
      console.error('Failed to toggle pin status:', error);
    }
  };

  /**
   * Start editing the class name
   */
  const startEditingClassName = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingName(classData.name);
  };

  /**
   * Handle changes to the class name input
   */
  const handleEditNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditingName(e.target.value);
  };

  /**
   * Save the edited class name
   */
  const saveClassName = async () => {
    // Only save if the name has changed and is not empty
    const trimmedName = editingName?.trim();
    if (trimmedName && trimmedName !== classData.name && classData.id) {
      try {
        await updateClass(classData.id, { name: trimmedName });
        await onDataChanged();
      } catch (error) {
        console.error('Failed to update class name:', error);
      }
    }
    setEditingName(null);
  };
  
  /**
   * Handle keyboard events in the name input
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      saveClassName();
    } else if (e.key === 'Escape') {
      setEditingName(null); 
    }
  };

  /**
   * Handle delete button click
   */
  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation(); 
    onRequestDelete(e);
  };

  // Focus and select the input when editing starts
  useEffect(() => {
    if (editingName !== null && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select(); 
    }
  }, [editingName]);

  // Determine card class based on state
  const cardClassName = `
    bg-gray-800 p-4 rounded-lg shadow-lg transition-colors group relative
    ${editingName === null ? 'cursor-pointer hover:bg-gray-700' : ''}
    ${classData.isPinned ? 'border-l-4 border-green-400' : 'border-l-4 border-transparent'}
  `;

  // Determine pin button class based on state
  const pinButtonClassName = `
    p-1.5 rounded-full transition-colors 
    ${classData.isPinned 
      ? 'text-green-400 hover:text-green-300 bg-gray-700 hover:bg-gray-600' 
      : 'text-gray-400 hover:text-green-400 hover:bg-gray-700'}
  `;

  return (
    <div
      onClick={editingName === null ? onSelect : undefined} 
      className={cardClassName.trim()}
      role="button"
      tabIndex={editingName === null ? 0 : -1}
      onKeyDown={(e) => {
        if (editingName === null && (e.key === 'Enter' || e.key === ' ')) {
          onSelect();
        }
      }}
    >
      {/* Action buttons */}
      <div className="absolute top-3 right-3 flex items-center space-x-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
        <button
          onClick={handleTogglePin}
          className={pinButtonClassName.trim()}
          aria-label={classData.isPinned ? "Unpin class" : "Pin class"}
          title={classData.isPinned ? "Unpin class" : "Pin class"}
        >
          <PinIcon isPinned={classData.isPinned || false} className="h-4 w-4"/>
        </button>
        <button
          onClick={handleDeleteClick}
          className="p-1.5 text-gray-400 hover:text-red-500 rounded-full hover:bg-gray-700 transition-colors"
          aria-label="Delete class"
          title="Delete class"
        >
          <DeleteIcon />
        </button>
      </div>

      {/* Class name - editable or display */}
      <div className="mb-2 pr-16"> 
        {editingName !== null ? (
          <input
            ref={inputRef}
            type="text"
            value={editingName}
            onChange={handleEditNameChange}
            onKeyDown={handleKeyDown}
            onBlur={saveClassName} 
            className="text-xl font-bold bg-gray-700 text-gray-200 p-1 rounded w-full focus:ring-2 focus:ring-green-400 outline-none"
            onClick={(e) => e.stopPropagation()} 
            aria-label="Edit class name"
          />
        ) : (
          <div className="flex items-center space-x-2 min-w-0 group/name_edit"> 
            <h3 className="text-xl font-bold text-gray-200 truncate" title={classData.name}>
              {classData.name}
            </h3>
            <button
              onClick={startEditingClassName}
              className="text-gray-400 hover:text-green-400 transition-colors opacity-0 group-hover/name_edit:opacity-100 focus:opacity-100"
              aria-label="Edit class name"
            >
              <EditIcon />
            </button>
          </div>
        )}
      </div>
      
      {/* Class metadata */}
      <div className="text-sm text-gray-400 mb-1">
        Created: {formatDate(classData.dateCreated)}
      </div>
      
      <div className="text-sm text-gray-400">
        {classData.totalItems || 0} {(classData.totalItems || 0) === 1 ? 'PDF' : 'PDFs'}
      </div>
      
      {/* Progress bar */}
      <ProgressBar 
        progress={classData.progress || 0}
        completedItems={classData.completedItems || 0}
        totalItems={classData.totalItems || 0}
      />
    </div>
  );
};

export default ClassCard;