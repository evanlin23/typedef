// src/components/FileUpload.tsx
import React, { useRef, useState, useCallback } from 'react';

interface FileUploadProps {
  onUpload: (files: FileList) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onUpload }) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);
  
  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); // Necessary to allow dropping
    e.stopPropagation();
    setIsDragging(true); // Keep true while dragging over
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // Check if the drag is leaving to outside the component or to an actual external element
    // relatedTarget is the element entered, currentTarget is the div listening for drag events
    if (!e.relatedTarget || !e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onUpload(e.dataTransfer.files);
      // Reset file input value to allow re-uploading the same file(s)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''; 
      }
    }
  }, [onUpload]);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUpload(e.target.files);
      // Reset file input value
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const baseClasses = 'border-2 border-dashed rounded-lg p-6 text-center transition-colors duration-200 ease-in-out';
  const inactiveClasses = 'border-gray-700 hover:border-gray-600';
  const activeClasses = 'border-green-400 bg-gray-800 ring-2 ring-green-400';

  return (
    <div className="mb-6">
      <div 
        className={`${baseClasses} ${isDragging ? activeClasses : inactiveClasses}`}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleButtonClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') {handleButtonClick();} }}
        aria-label="File upload area"
      >
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          onChange={handleFileInputChange}
          accept=".pdf,application/pdf" // More specific accept types
          multiple
          aria-hidden="true" // Hidden from accessibility tree as interaction is via div
        />
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