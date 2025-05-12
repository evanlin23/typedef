// src/components/PDFList.tsx
import { useState } from 'react';
import type { PDF } from '../utils/types';
import ConfirmationModal from './ConfirmationModal';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

/**
 * PDF list tab types
 */
type PDFListType = 'to-study' | 'done' | 'notes';

/**
 * PDF status types
 */
type PDFStatus = 'to-study' | 'done';

/**
 * Props for the PDFList component
 */
interface PDFListProps {
  /** List of PDFs to display */
  pdfs: PDF[];
  /** Type of list to display (affects empty state message) */
  listType: PDFListType;
  /** Callback when PDF status is changed */
  onStatusChange: (id: number, status: PDFStatus) => void;
  /** Callback when PDF is deleted */
  onDelete: (id: number) => void;
  /** Callback when PDF is viewed */
  onViewPDF: (pdf: PDF) => void;
  /** Callback when PDF order is changed */
  onOrderChange: (orderedPDFs: PDF[]) => void; 
}

/**
 * Delete confirmation state interface
 */
interface DeleteConfirmationState {
  isOpen: boolean;
  pdfId: number | null;
}

/**
 * Props for the SortablePDFItem component
 */
interface SortablePDFItemProps {
  /** PDF data to display */
  pdf: PDF;
  /** Callback when PDF status is changed */
  onStatusChange: (id: number, status: PDFStatus) => void;
  /** Callback when PDF deletion is requested */
  onDeleteRequest: (id: number, e: React.MouseEvent) => void;
  /** Callback when PDF is viewed */
  onViewPDF: (pdf: PDF) => void;
}

/**
 * Formats a timestamp into a readable date string
 */
const formatDate = (timestamp: number): string => {
  return new Date(timestamp).toLocaleDateString(undefined, { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
};

/**
 * Formats a file size in bytes to a human-readable string
 */
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']; 
  const i = Math.max(0, Math.floor(Math.log(bytes) / Math.log(k))); 
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

/**
 * PDF document icon component
 */
const PDFIcon = ({ className = "" }: { className?: string }) => (
  <svg 
    className={className}
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
);

/**
 * Drag handle icon component
 */
const DragHandleIcon = () => (
  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

/**
 * Component for a sortable PDF item in the list
 */
const SortablePDFItem = ({ pdf, onStatusChange, onDeleteRequest, onViewPDF }: SortablePDFItemProps) => {
  // Ensure PDF has an ID
  if (pdf.id === undefined) {
    console.warn('PDF without ID passed to SortablePDFItem');
    return null;
  }

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: pdf.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined, 
    opacity: isDragging ? 0.8 : 1,
  };
  
  const itemClassName = `
    flex flex-col sm:flex-row items-start sm:items-center justify-between 
    p-4 border border-gray-700 rounded-lg bg-gray-900 group mb-4
    ${isDragging ? 'shadow-2xl ring-2 ring-green-400' : 'hover:bg-gray-800/70'}
  `;

  // Determine the status toggle button appearance
  const statusToggleButtonClass = `
    px-3 py-1.5 text-sm rounded transition-colors focus:outline-none focus:ring-2 
    ${pdf.status === 'to-study' 
      ? 'bg-green-600 hover:bg-green-700 text-white focus:ring-green-500' 
      : 'bg-yellow-600 hover:bg-yellow-700 text-white focus:ring-yellow-500'}
  `;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={itemClassName.trim()}
    >
      {/* Drag Handle Area + Info */}
      <div className="flex items-center mb-3 sm:mb-0 flex-1 min-w-0 mr-4">
        <button 
          {...listeners} 
          className="p-1 mr-2 text-gray-500 hover:text-gray-300 cursor-grab active:cursor-grabbing focus:outline-none" 
          aria-label="Drag to reorder"
        >
          <DragHandleIcon />
        </button>
        
        <PDFIcon className="h-8 w-8 text-purple-400 flex-shrink-0" />
        
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
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label={`View ${pdf.name}`}
        >
          View
        </button>
        
        <button
          onClick={() => pdf.id !== undefined && onStatusChange(pdf.id, pdf.status === 'to-study' ? 'done' : 'to-study')}
          className={statusToggleButtonClass.trim()}
          aria-label={pdf.status === 'to-study' ? `Mark ${pdf.name} as done` : `Mark ${pdf.name} to study again`}
        >
          {pdf.status === 'to-study' ? 'Mark Done' : 'Study Again'}
        </button>
        
        <button
          onClick={(e) => pdf.id !== undefined && onDeleteRequest(pdf.id, e)}
          className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
          aria-label={`Delete ${pdf.name}`}
        >
          Delete
        </button>
      </div>
    </div>
  );
};

/**
 * Empty state component for when no PDFs are available
 */
const EmptyPDFList = ({ listType }: { listType: PDFListType }) => {
  const emptyMessage = listType === 'to-study' 
    ? 'No PDFs to study. Upload some to get started!'
    : "You haven't completed any PDFs yet. Keep up the great work!";
  
  return (
    <div className="text-center py-12 bg-gray-800/50 rounded-lg">
      <PDFIcon className="mx-auto h-12 w-12 text-gray-500" />
      <h3 className="mt-3 text-lg font-medium text-gray-200">No PDFs Available</h3>
      <p className="mt-1 text-sm text-gray-400">{emptyMessage}</p>
    </div>
  );
};

/**
 * Component for displaying and managing a list of PDFs
 */
const PDFList = ({ pdfs, listType, onStatusChange, onDelete, onViewPDF, onOrderChange }: PDFListProps) => {
  // State for delete confirmation modal
  const [confirmDelete, setConfirmDelete] = useState<DeleteConfirmationState>({
    isOpen: false,
    pdfId: null,
  });

  // Configure drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  /**
   * Open delete confirmation modal
   */
  const requestDeleteConfirmation = (pdfId: number, e: React.MouseEvent) => {
    e.stopPropagation(); 
    setConfirmDelete({ isOpen: true, pdfId });
  };

  /**
   * Handle confirmed PDF deletion
   */
  const handleDeleteConfirmed = () => { 
    if (confirmDelete.pdfId === null) return;
    
    onDelete(confirmDelete.pdfId);
    setConfirmDelete({ isOpen: false, pdfId: null });
  };

  /**
   * Handle cancel of PDF deletion
   */
  const handleCancelDelete = () => {
    setConfirmDelete({ isOpen: false, pdfId: null });
  };

  /**
   * Handle drag end event for reordering PDFs
   */
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) return;
    
    const oldIndex = pdfs.findIndex((pdf) => pdf.id === active.id);
    const newIndex = pdfs.findIndex((pdf) => pdf.id === over.id);
    
    if (oldIndex === -1 || newIndex === -1) {
      console.warn('Could not find dragged item or drop target in PDF list for DND.');
      return;
    }

    const newOrderedPDFs = arrayMove(pdfs, oldIndex, newIndex);
    onOrderChange(newOrderedPDFs); 
  };

  // Show empty state if no PDFs and in a relevant tab
  if (pdfs.length === 0 && (listType === 'to-study' || listType === 'done')) {
    return <EmptyPDFList listType={listType} />;
  }
  
  // Filter out PDFs without IDs and get sortable IDs
  const validPdfs = pdfs.filter(pdf => pdf.id !== undefined);
  const sortablePdfIds = validPdfs.map(pdf => pdf.id!);

  return (
    <div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={sortablePdfIds} strategy={verticalListSortingStrategy}>
          {validPdfs.map((pdf) => (
            <SortablePDFItem
              key={pdf.id}
              pdf={pdf}
              onStatusChange={onStatusChange}
              onDeleteRequest={requestDeleteConfirmation}
              onViewPDF={onViewPDF}
            />
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