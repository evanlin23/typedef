import React, { useState, useCallback, useRef, DragEvent, ChangeEvent } from 'react';
import JSZip from 'jszip';

// Interfaces remain the same
interface ProcessedFile {
  flattenedName: string;
  originalPath: string; // Path relative *within* the selected/dropped folder
  content: string;
}

// Interfaces for FileSystemEntry (used by drag & drop) remain the same
interface FileSystemEntry {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  fullPath: string;
  filesystem: FileSystem;
  createReader?(): FileSystemDirectoryReader;
  file?(successCallback: (file: File) => void, errorCallback?: (error: Error) => void): void;
}
interface FileSystemDirectoryReader { readEntries(successCallback: (entries: FileSystemEntry[]) => void, errorCallback?: (error: Error) => void): void; }
interface FileSystemFileEntry extends FileSystemEntry { isFile: true; isDirectory: false; file(successCallback: (file: File) => void, errorCallback?: (error: Error) => void): void; }
interface FileSystemDirectoryEntry extends FileSystemEntry { isFile: false; isDirectory: true; createReader(): FileSystemDirectoryReader; }


function FolderFlattener() {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [processedFiles, setProcessedFiles] = useState<ProcessedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [droppedFolderName, setDroppedFolderName] = useState<string | null>(null);

  // Ref for the hidden file input
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Helper: Reset State ---
  const resetState = () => {
    setError(null);
    setProcessedFiles([]);
    setDroppedFolderName(null);
    setIsDraggingOver(false);
    // Also clear the file input value if it exists
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  // --- Processing Logic for FileList (from Input) ---
  const processFileList = async (files: FileList | null): Promise<ProcessedFile[]> => {
      if (!files || files.length === 0) {
          console.log("No files selected or FileList is empty.");
          return []; // Return empty array if no files
      }

      let rootFolderName: string | null = null;
      const fileProcessingPromises: Promise<ProcessedFile | null>[] = [];

      // Determine root folder name from the first file's path
      if (files[0].webkitRelativePath) {
          rootFolderName = files[0].webkitRelativePath.split('/')[0];
      } else {
          // Fallback if webkitRelativePath is missing (less likely for directory selection)
          // Or maybe the user selected files instead of a folder?
          // We might need a more robust way or inform the user.
          console.warn("Could not determine root folder name from webkitRelativePath.");
          // Attempt to find a common prefix? For now, use a default or error out.
          rootFolderName = "selected_folder"; // Placeholder
      }
      setDroppedFolderName(rootFolderName); // Set state for UI feedback

      for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const relativePath = file.webkitRelativePath;

          if (!relativePath) {
              console.warn(`Skipping file ${file.name} as it lacks webkitRelativePath.`);
              continue; // Skip files without relative path (shouldn't happen with folder select)
          }

          // Only process TS/TSX files
          if (file.name.endsWith('.ts') || file.name.endsWith('.tsx')) {
              fileProcessingPromises.push(
                  (async (): Promise<ProcessedFile | null> => {
                      try {
                          const content = await file.text();
                          // Path for comment (relative within the selected folder)
                          // Remove the root folder part from webkitRelativePath for the comment
                          const pathForComment = relativePath.substring(rootFolderName!.length + 1);

                          const originalPathComment = `// Original path: ${pathForComment || file.name}\n`; // Use filename if path is just the root
                          const modifiedContent = originalPathComment + content;

                          // Flattened name: root_folder_src_components_Button.tsx
                          // Replace slashes in the *full* relative path with underscores
                          const flattenedName = `${rootFolderName}_${relativePath.replace(/\//g, '_')}`;

                          return {
                              flattenedName,
                              originalPath: pathForComment || file.name, // Store the path used in the comment
                              content: modifiedContent,
                          };
                      } catch (readError) {
                          console.error(`Error reading file ${relativePath}:`, readError);
                          // Optionally add to an error list state
                          return null; // Indicate failure for this file
                      }
                  })()
              );
          }
      }

      const results = await Promise.all(fileProcessingPromises);
      return results.filter((file): file is ProcessedFile => file !== null); // Filter out nulls (errors)
  };


  // --- Processing Logic for Drag & Drop (FileSystemEntry) ---
  // (Keep the existing processDirectoryEntry and processFileEntry from previous step)
  const processDirectoryEntry = async (
      directoryEntry: FileSystemDirectoryEntry,
      currentRelativePath: string,
      rootFolderName: string
   ): Promise<ProcessedFile[]> => {
      const reader = directoryEntry.createReader();
      let allEntries: FileSystemEntry[] = [];
      const readBatch = (): Promise<FileSystemEntry[]> => new Promise((resolve, reject) => reader.readEntries(resolve, reject));
      let batch;
      do { batch = await readBatch(); allEntries = allEntries.concat(batch); } while (batch.length > 0);

      let files: ProcessedFile[] = [];
      for (const entry of allEntries) {
          const entryRelativePath = currentRelativePath ? `${currentRelativePath}/${entry.name}` : entry.name;
          if (entry.isDirectory) {
              const subFiles = await processDirectoryEntry(entry as FileSystemDirectoryEntry, entryRelativePath, rootFolderName);
              files = files.concat(subFiles);
          } else if (entry.isFile && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
              try {
                 const processed = await processFileEntry(entry as FileSystemFileEntry, entryRelativePath, rootFolderName);
                 if (processed) files.push(processed);
              } catch (fileError) { console.error(`Skipping file due to error: ${entryRelativePath}`, fileError); }
          }
      }
      return files;
   };

  const processFileEntry = async (
      fileEntry: FileSystemFileEntry,
      relativePath: string, // relative *within* dropped folder
      rootFolderName: string
  ): Promise<ProcessedFile | null> => {
      return new Promise((resolve, reject) => {
          fileEntry.file( async (file) => {
                  try {
                      const content = await file.text();
                      const originalPathComment = `// Original path: ${relativePath}\n`;
                      const modifiedContent = originalPathComment + content;
                      const flattenedName = `${rootFolderName}_${relativePath.replace(/\//g, '_')}`;
                      resolve({ flattenedName, originalPath: relativePath, content: modifiedContent });
                  } catch (readError) { console.error(`Error reading file ${relativePath}:`, readError); reject(readError); }
              },
              (err) => { console.error(`Error accessing file metadata ${relativePath}:`, err); reject(err); }
          );
      });
  };


  // --- Event Handlers ---

  const handleDragEnter = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault(); event.stopPropagation(); setIsDraggingOver(true);
  }, []);
  const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault(); event.stopPropagation(); setIsDraggingOver(false);
  }, []);
  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = 'copy'; setIsDraggingOver(true);
  }, []);

  // Drag & Drop Handler
  const handleDrop = useCallback(async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    resetState(); // Use central reset function
    setIsProcessing(true);

    const items = event.dataTransfer.items;
    let folderProcessed = false;
    let rootName = "dropped_folder";

    try {
      if (items && items.length > 0) {
        const firstItem = items[0];
        const entry = firstItem.webkitGetAsEntry() as FileSystemEntry | null; // Cast for type safety

        if (entry && entry.isDirectory) {
           rootName = entry.name;
           setDroppedFolderName(rootName); // Set state
           const files = await processDirectoryEntry(entry as FileSystemDirectoryEntry, '', rootName);
           setProcessedFiles(files);
           folderProcessed = true;
        } else { setError("Please drop a single folder."); }
      } else { setError("Could not access dropped items."); }
      if (!folderProcessed && !error) { setError("No folder found in dropped items."); }
    } catch (err) {
      console.error("Error processing dropped folder:", err);
      setError(`Error processing folder: ${err instanceof Error ? err.message : String(err)}`);
      resetState(); // Ensure reset on error
    } finally {
      setIsProcessing(false);
      setIsDraggingOver(false); // Ensure drag over style is removed
    }
  }, []); // Dependencies: processDirectoryEntry, processFileEntry, resetState

  // Click Handler (triggers file input)
  const handleAreaClick = useCallback(() => {
      // Trigger click on the hidden file input element
      fileInputRef.current?.click();
  }, []); // No dependencies

  // File Input Change Handler
  const handleFileSelect = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
      resetState(); // Reset previous state/errors
      setIsProcessing(true);

      const files = event.target.files;

      try {
          if (!files || files.length === 0) {
              // This might happen if the user cancels the dialog
              console.log("File selection cancelled or no folder selected.");
              setError("No folder selected or selection cancelled.");
              setIsProcessing(false); // Stop processing early
              return;
          }
          // Check if directory selection likely worked (check webkitRelativePath on first file)
          if (!files[0]?.webkitRelativePath) {
             throw new Error("Folder selection failed or is not supported by your browser. Please try dragging and dropping.");
          }

          const processed = await processFileList(files);
          setProcessedFiles(processed);
          if (processed.length === 0 && !error) {
             // If processFileList returned empty but no specific error was set there
             setError("No .ts or .tsx files found in the selected folder.");
          }

      } catch (err) {
          console.error("Error processing selected folder:", err);
          setError(`Error processing selected folder: ${err instanceof Error ? err.message : String(err)}`);
          resetState(); // Ensure reset on error
      } finally {
          setIsProcessing(false);
          // Clear the input value so the same folder can be selected again
           if (event.target) {
               event.target.value = '';
           }
      }
  }, []); // Dependencies: processFileList, resetState

  // Download Handler (remains the same)
  const handleDownloadZip = useCallback(async () => {
    if (processedFiles.length === 0 || !droppedFolderName) return;
    const zip = new JSZip();
    processedFiles.forEach(file => zip.file(file.flattenedName, file.content));
    try {
        const blob = await zip.generateAsync({ type: 'blob' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${droppedFolderName}_flattened.zip`;
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    } catch (err) {
        console.error("Error generating zip file:", err);
        setError(`Failed to generate zip: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [processedFiles, droppedFolderName]);

  // --- Render ---
  return (
    <div className="max-w-4xl mx-auto p-6 bg-white shadow-lg rounded-lg">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Project Folder Flattener (TS/TSX)</h2>

      {/* Hidden File Input */}
      <input
          type="file"
          webkitdirectory="" // Note: empty string value often needed
          directory=""       // Standard attribute
          className="hidden" // Tailwind's hidden class
          ref={fileInputRef}
          onChange={handleFileSelect}
          multiple // Important for folder selection
      />

      {/* Clickable Drop Zone */}
      <div
        id="drop-zone"
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors duration-200 
          ${isDraggingOver 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'}`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleAreaClick} // Add onClick handler here
        role="button" // Add accessibility role
        tabIndex={0} // Make it focusable
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleAreaClick(); }} // Allow activation with keyboard
        title="Click to select folder or drag and drop here" // Tooltip
      >
        {isProcessing ? (
          <p className="text-gray-600 font-medium">
            Processing folder '{droppedFolderName || '...'}'...
          </p>
        ) : (
          // Updated prompt
          <p className="text-gray-600 font-medium">
            Drag & drop your project folder here, or click to select
          </p>
        )}
      </div>

      {error && <p className="mt-4 p-3 bg-red-100 text-red-700 rounded-md">Error: {error}</p>}

      {processedFiles.length > 0 && !isProcessing && (
        <div className="mt-8 bg-gray-50 p-6 rounded-md">
          <h3 className="text-xl font-semibold text-gray-700 mb-4">
            Processed Files from "{droppedFolderName || 'Selected Folder'}" ({processedFiles.length}):
          </h3>
           <button 
             onClick={handleDownloadZip} 
             disabled={isProcessing || !droppedFolderName}
             className="mb-4 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md 
                       transition-colors duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed"
           >
              Download All as ZIP
           </button>
          <ul className="space-y-2 mt-4">
            {processedFiles.map((file) => (
              <li key={file.flattenedName} className="border-b border-gray-200 pb-2">
                <code className="bg-gray-100 text-blue-600 px-1 rounded">{file.flattenedName}</code> 
                <span className="text-gray-600 ml-2">
                  (Original: <code className="bg-gray-100 text-violet-600 px-1 rounded">{file.originalPath}</code>)
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
       {!processedFiles.length && !isProcessing && !error && droppedFolderName && (
          <p className="mt-4 text-gray-600 italic">
            No .ts or .tsx files found in "{droppedFolderName}".
          </p>
       )}
    </div>
  );
}

export default FolderFlattener;