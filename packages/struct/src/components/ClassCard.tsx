import React, { useState } from 'react';
import type { Class } from '../utils/types';
import { updateClass } from '../utils/db';
import PinIcon from './PinIcon';
import ProgressBar from './ProgressBar';

interface ClassCardProps {
  classData: Class;
  onSelect: () => void;
  onRequestDelete: (e: React.MouseEvent) => void;
  onDataChanged: () => Promise<void>;
}

const ClassCard: React.FC<ClassCardProps> = ({ 
  classData, 
  onSelect, 
  onRequestDelete,
  onDataChanged
}) => {
  const [editingName, setEditingName] = useState<string | null>(null);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString();
  };

  const handleTogglePin = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await updateClass(classData.id!, { isPinned: !classData.isPinned });
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

  const saveClassName = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && editingName && editingName.trim()) {
      try {
        await updateClass(classData.id!, { name: editingName.trim() });
        setEditingName(null);
        await onDataChanged();
      } catch (error) {
        console.error('Failed to update class name:', error);
      }
    } else if (e.key === 'Escape') {
      setEditingName(null);
    }
  };

  const handleClickOutside = async () => {
    if (editingName && editingName.trim()) {
      try {
        await updateClass(classData.id!, { name: editingName.trim() });
        await onDataChanged();
      } catch (error) {
        console.error('Failed to update class name:', error);
      }
    }
    setEditingName(null);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRequestDelete(e);
  };

  return (
    <div
      onClick={onSelect}
      className={`bg-gray-800 p-6 rounded-lg shadow-lg cursor-pointer hover:bg-gray-700 transition-colors
        ${classData.isPinned ? 'border-l-4 border-green-400' : ''}`}
    >
      <div className="flex justify-between items-start">
        {editingName !== null ? (
          <input
            type="text"
            value={editingName}
            onChange={handleEditNameChange}
            onKeyDown={saveClassName}
            onBlur={handleClickOutside}
            autoFocus
            className="text-xl font-bold bg-gray-700 text-gray-200 p-1 rounded w-full"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <div className="flex items-center">
            <h3 className="text-xl font-bold text-gray-200 truncate">
              {classData.name}
            </h3>
            <button
              onClick={startEditingClassName}
              className="ml-2 text-gray-400 hover:text-green-400 transition-colors"
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
            <button
              onClick={handleTogglePin}
              className={`ml-2 transition-colors ${classData.isPinned ? 'text-green-400' : 'text-gray-400 hover:text-green-400'}`}
            >
              <PinIcon isPinned={classData.isPinned || false} />
            </button>
          </div>
        )}
        <button
          onClick={handleDeleteClick}
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
        Created: {formatDate(classData.dateCreated)}
      </div>
      
      <div className="mt-1 text-gray-400 text-sm">
        {classData.pdfCount} {classData.pdfCount === 1 ? 'PDF' : 'PDFs'}
      </div>
      
      <ProgressBar 
        progress={classData.progress || 0}
        completedItems={classData.doneCount || 0}
        totalItems={classData.pdfCount}
      />
      
      <div className="mt-4">
        <button className="w-full bg-blue-500 text-center py-2 rounded text-gray-200 hover:bg-blue-600 transition-colors">
          Open Class
        </button>
      </div>
    </div>
  );
};

export default ClassCard;