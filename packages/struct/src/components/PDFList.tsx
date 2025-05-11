// src/components/PDFList.tsx
import React, { useState } from 'react';
import type { PDF } from '../utils/types';
import ConfirmationModal from './ConfirmationModal';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core'; 
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface PDFListProps {
  pdfs: PDF[];
  listType: 'to-study' | 'done' | 'notes'; // 'notes' type not used by this component for rendering list
  onStatusChange: (id: number, status: 'to-study' | 'done') => void;
  onDelete: (id: number) => void;
  onViewPDF: (pdf: PDF) => void;
  onOrderChange: (orderedPDFs: PDF[]) => void; 
}

interface SortablePDFItemProps {
  pdf: PDF;
  onStatusChange: (id: number, status: 'to-study' | 'done') => void;
  onDeleteRequest: (id: number, e: React.MouseEvent) => void; // Changed prop name
  onViewPDF: (pdf: PDF) => void;
}

const SortablePDFItem: React.FC<SortablePDFItemProps> = ({ pdf, onStatusChange, onDeleteRequest, onViewPDF }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: pdf.id! });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined, 
    opacity: isDragging ? 0.8 : 1,
  };
  
  const formatDate = (timestamp: number): string => new Date(timestamp).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) {return '0 Bytes';}
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']; 
    const i = Math.max(0, Math.floor(Math.log(bytes) / Math.log(k))); 
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes} // Spread attributes for dnd-kit
      className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border border-gray-700 rounded-lg bg-gray-900 group mb-4
        ${isDragging ? 'shadow-2xl ring-2 ring-green-400' : 'hover:bg-gray-800/70'}`}
    >
      {/* Drag Handle Area + Info */}
      <div className="flex items-center mb-3 sm:mb-0 flex-1 min-w-0 mr-4">
        <button {...listeners} className="p-1 mr-2 text-gray-500 hover:text-gray-300 cursor-grab active:cursor-grabbing focus:outline-none" aria-label="Drag to reorder">
          <svg className="h-6 w-6 " fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <svg 
          className="h-8 w-8 text-purple-400 flex-shrink-0" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
        </svg>
        <div className="ml-3 min-w-0"> 
          <h3 className="text-gray-200 font-medium truncate" title={pdf.name}>
            {pdf.name}
          </h3>
          <div className="flex flex-col sm:flex-row text-xs text-gray-400">
            <span>{formatFileSize(pdf.size)}</span>
            <span className="hidden sm:inline mx-1.5">•</span>
            <span>Added on {formatDate(pdf.dateAdded)}</span>
          </div>
        </div>
      </div>
      
      {/* Action Buttons */}
      <div className="flex space-x-2 mt-2 sm:mt-0 flex-shrink-0">
        <button
          onClick={() => onViewPDF(pdf)}
          className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
          aria-label={`View ${pdf.name}`}
        >
          View
        </button>
        
        <button
          onClick={() => onStatusChange(pdf.id!, pdf.status === 'to-study' ? 'done' : 'to-study')}
          className={`px-3 py-1.5 text-sm text-white rounded transition-colors focus:outline-none focus:ring-2 ${
            pdf.status === 'to-study'
              ? 'bg-green-500 hover:bg-green-600 focus:ring-green-400'
              : 'bg-gray-600 hover:bg-gray-500 focus:ring-gray-400'
          }`}
          aria-label={pdf.status === 'to-study' ? `Mark ${pdf.name} as done` : `Mark ${pdf.name} to study again`}
        >
          {pdf.status === 'to-study' ? 'Mark Done' : 'Study Again'}
        </button>
        
        <button
          onClick={(e) => onDeleteRequest(pdf.id!, e)}
          className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
          aria-label={`Delete ${pdf.name}`}
        >
          Delete
        </button>
      </div>
    </div>
  );
};

const PDFList: React.FC<PDFListProps> = ({ pdfs, listType, onStatusChange, onDelete, onViewPDF, onOrderChange }) => {
  const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; pdfId: number | null }>({
    isOpen: false,
    pdfId: null,
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const requestDeleteConfirmation = (pdfId: number, e: React.MouseEvent) => {
    e.stopPropagation(); 
    setConfirmDelete({ isOpen: true, pdfId });
  };

  const handleDeleteConfirmed = () => { 
    if (confirmDelete.pdfId === null) {return;}
    onDelete(confirmDelete.pdfId); // Call the prop passed from App.tsx for actual deletion
    setConfirmDelete({ isOpen: false, pdfId: null });
  };

  const handleCancelDelete = () => {
    setConfirmDelete({ isOpen: false, pdfId: null });
  };

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = pdfs.findIndex((pdf) => pdf.id === active.id);
      const newIndex = pdfs.findIndex((pdf) => pdf.id === over.id);
      
      if (oldIndex === -1 || newIndex === -1) {
        console.warn('Could not find dragged item or drop target in PDF list for DND.');
        return;
      }

      const newOrderedPDFs = arrayMove(pdfs, oldIndex, newIndex);
      onOrderChange(newOrderedPDFs); 
    }
  }

  if (pdfs.length === 0 && (listType === 'to-study' || listType === 'done')) {
    const emptyMessage = listType === 'to-study' 
      ? 'No PDFs to study. Upload some to get started!'
      : "You haven't completed any PDFs yet. Keep up the great work!";
    return (
      <div className="text-center py-12 bg-gray-800/50 rounded-lg">
        <svg 
          className="mx-auto h-12 w-12 text-gray-500" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="1.5" 
          strokeLinecap="round" 
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
          <polyline points="13 2 13 9 20 9"></polyline>
        </svg>
        <h3 className="mt-3 text-lg font-medium text-gray-200">No PDFs Available</h3>
        <p className="mt-1 text-sm text-gray-400">{emptyMessage}</p>
      </div>
    );
  }
  
  const sortablePdfIds = pdfs.filter(pdf => pdf.id !== undefined).map(pdf => pdf.id!);

  return (
    <div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={sortablePdfIds} strategy={verticalListSortingStrategy}>
          {pdfs.map((pdf) => (
            pdf.id !== undefined && ( 
              <SortablePDFItem
                key={pdf.id}
                pdf={pdf}
                onStatusChange={onStatusChange}
                onDeleteRequest={requestDeleteConfirmation} // Pass the confirmation requester
                onViewPDF={onViewPDF}
              />
            )
          ))}
        </SortableContext>
      </DndContext>
      
      <ConfirmationModal
        isOpen={confirmDelete.isOpen}
        title="Delete PDF"
        message="Are you sure you want to delete this PDF? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleDeleteConfirmed}
        onCancel={handleCancelDelete}
        confirmButtonClass="bg-red-600 hover:bg-red-700 focus:ring-red-500"
      />
    </div>
  );
};

export default PDFList;