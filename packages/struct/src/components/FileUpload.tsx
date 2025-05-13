// src/components/FileUpload.tsx
import { useRef, useState, useCallback } from 'react';

/**
 * Props for the FileUpload component
 */
interface FileUploadProps {
  /** Callback when files are uploaded */
  onUpload: (files: FileList) => void;
}

/**
 * Upload icon component
 */
const UploadIcon = () => (
  <svg 
    className="mx-auto h-12 w-12 text-gray-400" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor"
    strokeWidth="1.5" 
    strokeLinecap="round" 
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
    <polyline points="17 8 12 3 7 8"></polyline>
    <line x1="12" y1="3" x2="12" y2="15"></line>
  </svg>
);

/**
 * Component for uploading PDF files via drag-and-drop or file selection
 */
const FileUpload = ({ onUpload }: FileUploadProps) => {
  // Track whether a file is being dragged over the component
  const [isDragging, setIsDragging] = useState(false);
  // Reference to the hidden file input element
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Reset the file input to allow re-uploading the same file
   */
  const resetFileInput = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  /**
   * Handle drag enter event
   */
  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);
  
  /**
   * Handle drag over event
   */
  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); // Necessary to allow dropping
    e.stopPropagation();
    setIsDragging(true); // Keep true while dragging over
  }, []);

  /**
   * Handle drag leave event
   */
  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Only set isDragging to false if the drag is leaving the component entirely
    // relatedTarget is the element entered, currentTarget is the div listening for drag events
    if (!e.relatedTarget || !e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }, []);

  /**
   * Handle file drop event
   */
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onUpload(e.dataTransfer.files);
      resetFileInput();
    }
  }, [onUpload, resetFileInput]);

  /**
   * Handle file selection via input element
   */
  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUpload(e.target.files);
      resetFileInput();
    }
  }, [onUpload, resetFileInput]);

  /**
   * Trigger file input click when the drop area is clicked
   */
  const handleButtonClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  /**
   * Handle keyboard events for accessibility
   */
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleButtonClick();
    }
  }, [handleButtonClick]);

  // CSS classes for styling the drop area
  const dropAreaClasses = `
    border-2 border-dashed rounded-lg p-6 text-center 
    transition-colors duration-200 ease-in-out
    ${isDragging 
    ? 'border-green-400 bg-gray-800 ring-2 ring-green-400' 
    : 'border-gray-700 hover:border-gray-600'}
  `;

  return (
    <div className="mb-6">
      <div 
        className={dropAreaClasses.trim()}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleButtonClick}
        role="button"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        aria-label="File upload area"
      >
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          onChange={handleFileInputChange}
          accept=".pdf,application/pdf"
          multiple
          aria-hidden="true"
        />
        <UploadIcon />
        <h3 className="mt-2 text-lg font-medium text-gray-200">
          Upload PDFs
        </h3>
        <p className="mt-1 text-sm text-gray-400">
          Drag & drop PDF files here, or click to select.
        </p>
      </div>
    </div>
  );
};

export default FileUpload;