import { useState, useCallback, useRef, type DragEvent, type ChangeEvent } from 'react';
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

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Helper: Reset Base State (UI/Data, not input value) ---
  const resetBaseState = useCallback(() => {
    setError(null);
    setProcessedFiles([]);
    setDroppedFolderName(null);
    setIsDraggingOver(false); // Primarily for drag state
    // IMPORTANT: Do NOT clear fileInputRef.current.value here.
    // It must be cleared by the specific handler after files are processed.
  }, []); // State setters are stable

  // --- Processing Logic for FileList (from Input) ---
  const processFileList = useCallback(async (files: FileList | null, currentFileInput: HTMLInputElement | null): Promise<ProcessedFile[]> => {
      if (!files || files.length === 0) {
          console.log("No files selected or FileList is empty.");
          // Ensure input is cleared if we bail early due to no files
          if (currentFileInput) currentFileInput.value = '';
          return [];
      }

      const firstFileWithRelativePath = Array.from(files).find(f => f.webkitRelativePath);

      if (!firstFileWithRelativePath?.webkitRelativePath) {
          console.warn("Could not determine root folder name from webkitRelativePath on any file.");
          setError("Folder selection failed: webkitRelativePath not found. Ensure you're selecting a folder.");
           // Ensure input is cleared
          if (currentFileInput) currentFileInput.value = '';
          return [];
      }

      const rootFolderNameFromFile = firstFileWithRelativePath.webkitRelativePath.split('/')[0];
      setDroppedFolderName(rootFolderNameFromFile);

      const fileProcessingPromises: Promise<ProcessedFile | null>[] = [];

      for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const webkitPath = file.webkitRelativePath;

          if (!webkitPath) {
              console.warn(`Skipping file ${file.name} as it lacks webkitRelativePath (unexpected for folder select).`);
              continue;
          }

          if (file.name.endsWith('.ts') || file.name.endsWith('.tsx')) {
              fileProcessingPromises.push(
                  (async (): Promise<ProcessedFile | null> => {
                      try {
                          const content = await file.text();
                          let pathWithinSelectedFolder = webkitPath.substring(rootFolderNameFromFile.length);
                          if (pathWithinSelectedFolder.startsWith('/')) {
                              pathWithinSelectedFolder = pathWithinSelectedFolder.substring(1);
                          }
                          if (!pathWithinSelectedFolder && file.name) {
                            pathWithinSelectedFolder = file.name;
                          }

                          const originalPathComment = `// Original path: ${pathWithinSelectedFolder}\n`;
                          const modifiedContent = originalPathComment + content;
                          const flattenedName = `${rootFolderNameFromFile}_${pathWithinSelectedFolder.replace(/\//g, '_')}`;

                          return {
                              flattenedName,
                              originalPath: pathWithinSelectedFolder,
                              content: modifiedContent,
                          };
                      } catch (readError) {
                          console.error(`Error reading file ${webkitPath}:`, readError);
                          return null;
                      }
                  })()
              );
          }
      }

      const results = await Promise.all(fileProcessingPromises);
      return results.filter((file): file is ProcessedFile => file !== null);
  }, [setDroppedFolderName, setError]); // Added setError

  // --- Processing Logic for Drag & Drop (FileSystemEntry) ---
   const processFileEntry = useCallback(async (
      fileEntry: FileSystemFileEntry,
      relativePath: string,
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
  }, []);

  const processDirectoryEntry = useCallback(async (
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
   }, [processFileEntry]);

  const handleDragEnter = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault(); event.stopPropagation(); setIsDraggingOver(true);
  }, []);
  const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault(); event.stopPropagation(); setIsDraggingOver(false);
  }, []);
  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = 'copy'; setIsDraggingOver(true);
  }, []);

  const handleDrop = useCallback(async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    
    resetBaseState(); // Reset UI data, not input value yet
    setIsProcessing(true);
    setIsDraggingOver(false);

    // Clear file input value in case it had a selection, drop takes precedence
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }

    const items = event.dataTransfer.items;
    let folderProcessed = false;
    let rootName = "dropped_folder";

    try {
      if (items && items.length > 0) {
        const firstItem = items[0];
        const entry = firstItem.webkitGetAsEntry() as FileSystemEntry | null;

        if (entry && entry.isDirectory) {
           rootName = entry.name;
           setDroppedFolderName(rootName);
           const files = await processDirectoryEntry(entry as FileSystemDirectoryEntry, '', rootName);
           setProcessedFiles(files);
           folderProcessed = true;
           if (files.length === 0 && !error) { // Check !error so we don't override a more specific one
             setError("No .ts or .tsx files found in the dropped folder.");
           }
        } else { setError("Please drop a single folder."); }
      } else { setError("Could not access dropped items."); }
      if (!folderProcessed && !error) {
        setError("No folder found in dropped items, or item was not a folder.");
      }
    } catch (err) {
      console.error("Error processing dropped folder:", err);
      setError(`Error processing folder: ${err instanceof Error ? err.message : String(err)}`);
      setProcessedFiles([]); // Ensure files are cleared on error
      setDroppedFolderName(null); // Ensure folder name is cleared
    } finally {
      setIsProcessing(false);
    }
  }, [resetBaseState, processDirectoryEntry, error]); // Added error to dep array for the conditional setError

  // File Input Change Handler
  const handleFileSelect = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
      resetBaseState(); // Reset UI data, does not touch event.target.value yet
      setIsProcessing(true);

      const files = event.target.files;
      const currentInputTarget = event.target; // Keep a reference

      console.log('handleFileSelect - files received:', files ? files.length : 'null');

      try {
          if (!files || files.length === 0) {
              // This typically means the user cancelled the dialog or selected nothing.
              setError("No folder selected or selection cancelled.");
              // No files to process, processing will stop.
              // Input value will be cleared in finally.
              return;
          }
          // Check if directory selection likely worked (check webkitRelativePath on first file)
          // A more robust check: any file has webkitRelativePath
          const hasWebkitPath = Array.from(files).some(f => f.webkitRelativePath);
          if (!hasWebkitPath && files.length > 0) { // files.length > 0 to ensure it's not just an empty selection
             throw new Error("Folder selection may have failed or is not fully supported for all files. Please ensure you are selecting a folder. Try dragging and dropping if issues persist.");
          }

          // Pass currentInputTarget to processFileList so it can clear it if it bails early
          const processed = await processFileList(files, currentInputTarget);
          setProcessedFiles(processed);

          if (processed.length === 0 && !error) { // Check !error
             setError("No .ts or .tsx files found in the selected folder.");
          }

      } catch (err) {
          console.error("Error processing selected folder:", err);
          setError(`Error processing selected folder: ${err instanceof Error ? err.message : String(err)}`);
          setProcessedFiles([]); // Ensure files cleared on error
          setDroppedFolderName(null); // Ensure folder name cleared
      } finally {
          setIsProcessing(false);
          // Clear the input value AFTER processing or error, so the same folder can be selected again
          if (currentInputTarget) {
             currentInputTarget.value = '';
          }
      }
  }, [resetBaseState, processFileList, error]); // Added error to dep array

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

  const handleBrowseClick = useCallback(() => {
    if (fileInputRef.current) {
      // Any error from a previous selection attempt will be cleared
      // by resetBaseState() when handleFileSelect is triggered.
      fileInputRef.current.click();
    }
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-6 bg-gray-700 shadow-lg rounded-lg text-gray-200">
      <h2 className="text-2xl font-bold text-orange-400 mb-2">Project Folder Flattener (TS/TSX)</h2>
      <p className="text-gray-300 mb-4">
        Flattens a folder structure by converting nested TS/TSX files into a zip with flattened filenames and path comments. I use it to flatten a directory before putting it into AI studio when vibe coding.
      </p>
      <input
          type="file"
          className="hidden"
          ref={fileInputRef}
          onChange={handleFileSelect}
          multiple
      />

      <div
        id="drop-zone"
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors duration-200 
          ${isDraggingOver 
            ? 'border-orange-400 bg-gray-600' 
            : 'border-gray-500 hover:border-orange-500 hover:bg-gray-600'}`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleBrowseClick}
        role="button"
        tabIndex={0}
        title="Drag and drop a folder here, or click to select a folder"
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleBrowseClick(); }} // Accessibility
      >
        {isProcessing ? (
          <p className="text-gray-300 font-medium">
            Processing folder '{droppedFolderName || '...'}'...
          </p>
        ) : (
          <p className="text-gray-300 font-medium">
            Drag & drop your project folder here, or click to select
          </p>
        )}
      </div>

      {error && <p className="mt-4 p-3 bg-red-900 text-red-100 rounded-md">Error: {error}</p>}

      {processedFiles.length > 0 && !isProcessing && (
        <div className="mt-8 bg-gray-800 p-6 rounded-md">
          <h3 className="text-xl font-semibold text-orange-400 mb-4">
            Processed Files from "{droppedFolderName || 'Selected Folder'}" ({processedFiles.length}):
          </h3>
           <button 
             onClick={handleDownloadZip} 
             disabled={isProcessing || !droppedFolderName || processedFiles.length === 0}
             className="mb-4 bg-orange-500 hover:bg-orange-600 text-gray-100 py-2 px-4 rounded-md 
                       transition-colors duration-200 disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed"
           >
              Download All as ZIP
           </button>
          <ul className="space-y-2 mt-4">
            {processedFiles.map((file) => (
              <li key={file.flattenedName} className="border-b border-gray-600 pb-2">
                <code className="bg-gray-700 text-orange-400 px-1 rounded">{file.flattenedName}</code> 
                <span className="text-gray-300 ml-2">
                  (Original: <code className="bg-gray-700 text-orange-300 px-1 rounded">{file.originalPath}</code>)
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
       {!processedFiles.length && !isProcessing && !error && droppedFolderName && (
          <p className="mt-4 text-gray-400 italic">
            No .ts or .tsx files found in "{droppedFolderName}".
          </p>
       )}
    </div>
  );
}

export default FolderFlattener;