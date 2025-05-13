import { useState, useCallback, useRef, type DragEvent as ReactDragEvent, type ChangeEvent } from 'react';
import { PDFDocument } from 'pdf-lib';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent, // Type from @dnd-kit/core
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Interface for tracking uploaded files with a stable ID for dnd
interface UploadedPdf {
  id: string; // Unique ID for dnd kit
  file: File;
}

// A separate component for the sortable item might be cleaner
interface SortablePdfItemProps {
  id: string;
  file: File;
  index: number;
  onRemove: (id: string) => void;
}

function SortablePdfItem({ id, file, index, onRemove }: SortablePdfItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 'auto', // Ensure dragging item is on top
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`p-3 flex justify-between items-center rounded border border-gray-600 transition-shadow ${
        isDragging ? 'bg-gray-600 border-orange-500 shadow-xl' : 'bg-gray-700'
      }`}
    >
      <div className="flex items-center space-x-2 overflow-hidden">
        {/* Drag Handle (listeners applied here) */}
        <button
          {...attributes}
          {...listeners}
          type="button"
          className="cursor-grab active:cursor-grabbing touch-none"
          aria-label="Drag to reorder"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
          </svg>
        </button>
        <span className="text-sm text-gray-200 truncate" title={file.name}>
          {index + 1}. {file.name}
        </span>
        <span className="text-xs text-gray-400 ml-2 flex-shrink-0">
          ({(file.size / 1024 / 1024).toFixed(2)} MB)
        </span>
      </div>

      <button
        onClick={() => onRemove(id)}
        className="ml-4 text-red-500 hover:text-red-400 transition-colors flex-shrink-0"
        title="Remove this file"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
    </li>
  );
}


function PdfCombiner() {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedPdf[]>([]);
  const [isDraggingOverZone, setIsDraggingOverZone] = useState(false); // For drop zone
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateUniqueId = () => `pdf-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  const addFilesToList = useCallback((newFiles: FileList | File[]) => {
    setError(null);
    const pdfFiles = Array.from(newFiles).filter(
      (file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    );

    if (pdfFiles.length === 0 && newFiles.length > 0) {
      setError("No valid PDF files found. Please select or drop files ending with .pdf.");
      return;
    }
    if (pdfFiles.length === 0) return;

    const newUploadedPdfs: UploadedPdf[] = pdfFiles.map((file) => ({
      id: generateUniqueId(),
      file: file,
    }));

    setUploadedFiles((prevFiles) => [...prevFiles, ...newUploadedPdfs]);
  }, []);

  const handleZoneDragEnter = useCallback((event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault(); event.stopPropagation(); setIsDraggingOverZone(true);
  }, []);
  const handleZoneDragLeave = useCallback((event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault(); event.stopPropagation();
     if (!event.currentTarget.contains(event.relatedTarget as Node)) {
        setIsDraggingOverZone(false);
     }
  }, []);
  const handleZoneDragOver = useCallback((event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = 'copy'; setIsDraggingOverZone(true);
  }, []);
  const handleZoneDrop = useCallback((event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault(); event.stopPropagation();
    setIsDraggingOverZone(false); setError(null);
    const files = event.dataTransfer.files;
    if (files && files.length > 0) {
      addFilesToList(files);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [addFilesToList]);

  const handleFileSelect = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const files = event.target.files;
    if (files && files.length > 0) addFilesToList(files);
    if (event.target) event.target.value = '';
  }, [addFilesToList]);

  const handleBrowseClick = useCallback(() => fileInputRef.current?.click(), []);
  const handleRemoveFile = useCallback((idToRemove: string) => {
    setUploadedFiles((prevFiles) => prevFiles.filter(f => f.id !== idToRemove));
    if (uploadedFiles.length === 1 && error?.includes("at least two")) setError(null);
  }, [uploadedFiles, error]);
  const handleClearAll = useCallback(() => { setUploadedFiles([]); setError(null); }, []);

  // --- @dnd-kit Reordering Logic ---
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), // Drag only after 5px move
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setUploadedFiles((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return items; // Should not happen
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }, []);

  // --- PDF Combination Logic (remains the same) ---
  const handleCombinePdfs = useCallback(async () => {
    if (uploadedFiles.length < 2) {
      setError("Please upload at least two PDF files to combine.");
      return;
    }
    setIsProcessing(true); setError(null);
    try {
      const mergedPdf = await PDFDocument.create();
      for (const uploadedPdf of uploadedFiles) {
        try {
          const arrayBuffer = await uploadedPdf.file.arrayBuffer();
          const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
          if (pdfDoc.isEncrypted) {
             throw new Error(`File "${uploadedPdf.file.name}" is encrypted and cannot be processed.`);
          }
          const copiedPages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
          copiedPages.forEach((page) => mergedPdf.addPage(page));
        } catch (fileError) {
            console.error(`Error processing file ${uploadedPdf.file.name}:`, fileError);
             if (fileError instanceof Error && fileError.message.includes('encrypted')) {
                 throw new Error(`Could not process "${uploadedPdf.file.name}" as it appears to be encrypted.`);
             } else {
                 throw new Error(`Failed to process file "${uploadedPdf.file.name}". Error: ${fileError instanceof Error ? fileError.message : String(fileError)}`);
             }
        }
      }
      if (mergedPdf.getPageCount() === 0) {
          throw new Error("No pages could be added to the combined PDF.");
      }
      const mergedPdfBytes = await mergedPdf.save();
      const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'combined_document.pdf';
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (err) {
      console.error("Error combining PDFs:", err);
      setError(`Failed to combine PDFs: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsProcessing(false);
    }
  }, [uploadedFiles]);

  return (
    <div className="max-w-4xl mx-auto p-6 bg-gray-700 shadow-lg rounded-lg text-gray-200">
      <h2 className="text-2xl font-bold text-orange-400 mb-2">PDF Combiner</h2>
      <p className="text-gray-300 mb-4">
        Upload multiple PDF files, reorder them as needed, and combine them into a single downloadable PDF.
      </p>
      <input
          type="file" className="hidden" ref={fileInputRef} onChange={handleFileSelect}
          multiple accept="application/pdf,.pdf"
      />

      <div
        id="drop-zone-pdf"
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors duration-200
          ${isDraggingOverZone ? 'border-orange-400 bg-gray-600' : 'border-gray-500 hover:border-orange-500 hover:bg-gray-600'}`}
        onDragEnter={handleZoneDragEnter} onDragLeave={handleZoneDragLeave}
        onDragOver={handleZoneDragOver} onDrop={handleZoneDrop}
        onClick={handleBrowseClick} role="button" tabIndex={0}
        title="Drag and drop PDF files here, or click to select files"
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleBrowseClick(); }}
      >
        {isProcessing ? (<p>Combining PDFs...</p>) : (<p>Drag & drop PDF files here, or click to select</p>)}
      </div>

      {error && <p className="mt-4 p-3 bg-red-900 text-red-100 rounded-md">Error: {error}</p>}

      {uploadedFiles.length > 0 && (
        <div className="mt-6 bg-gray-800 p-4 rounded-md">
          <div className="flex justify-between items-center mb-3">
             <h3 className="text-lg font-semibold text-orange-400">Files to Combine ({uploadedFiles.length})</h3>
              <button onClick={handleClearAll} className="text-sm text-red-400 hover:text-red-300" title="Remove all files">
                Clear All
              </button>
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={uploadedFiles.map(f => f.id)} strategy={verticalListSortingStrategy}>
              <ul className="space-y-2">
                {uploadedFiles.map((uploadedPdf, index) => (
                  <SortablePdfItem
                    key={uploadedPdf.id}
                    id={uploadedPdf.id}
                    file={uploadedPdf.file}
                    index={index}
                    onRemove={handleRemoveFile}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>

          <div className="mt-6 text-center">
            <button
              onClick={handleCombinePdfs} disabled={isProcessing || uploadedFiles.length < 2}
              className="bg-orange-500 hover:bg-orange-600 text-gray-100 py-2 px-6 rounded-md transition-colors duration-200 disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              {isProcessing ? 'Processing...' : `Combine ${uploadedFiles.length} PDFs`}
            </button>
            {uploadedFiles.length > 0 && uploadedFiles.length < 2 && !isProcessing && (
                 <p className="text-sm text-yellow-400 mt-2">Need at least 2 files to combine.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default PdfCombiner;