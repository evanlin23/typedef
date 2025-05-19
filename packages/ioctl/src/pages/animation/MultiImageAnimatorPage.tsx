// src/pages/animation/MultiImageAnimatorPage.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { fetchFile } from '@ffmpeg/util';
import { v4 as uuidv4 } from 'uuid';

import {
  OUTPUT_WIDTH, OUTPUT_HEIGHT, FPS, MAX_FILE_SIZE_MB,
  DEFAULT_RELATIVE_ZOOM_IN_FACTOR, DEFAULT_ZOOM_LEVEL_OUT_EFFECTIVE,
  INITIAL_ZOOM_OPTIONS, TOTAL_DURATION_SEC, TRANSITION_DURATION_SEC, TRANSITION_OVERLAP_SEC, DURATION_ZOOM_OUT,
  PRE_ZOOMPAN_UPSCALE_FACTOR, // Added for description
} from './shared/ffmpegConstants';
import type { Point, AnimationItemData, ZoomSettings } from './shared/ffmpegTypes';
import { useFFmpeg } from './shared/useFFmpeg';
import {
  generateSingleClipFilterGraph,
  getDefaultFfmpegCommandArgs,
  getFileExtension,
} from './shared/ffmpegAnimationCore';

interface ImageItem {
  id: string;
  file: File;
  previewUrl: string;
  points: Point[];
  naturalWidth: number;
  naturalHeight: number;
}

function MultiImageAnimatorPage() {
  const [imageItems, setImageItems] = useState<ImageItem[]>([]);
  const [activeImageIndex, setActiveImageIndex] = useState<number | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>('');
  
  const [isAnimating, setIsAnimating] = useState<boolean>(false); // For animation process
  const [isFFmpegCoreLoading, setIsFFmpegCoreLoading] = useState<boolean>(true); // For FFmpeg.js loading
  const [ffmpegLoaded, setFfmpegLoaded] = useState<boolean>(false);
  const [ffmpegLog, setFfmpegLog] = useState<string>('');
  
  const [currentOperationProgress, setCurrentOperationProgress] = useState(0); // 0-1 for current ffmpeg task
  const [overallProgress, setOverallProgress] = useState(0); // 0-1 for all tasks
  const [currentTaskDescription, setCurrentTaskDescription] = useState("");

  const [relativeZoomInFactor, setRelativeZoomInFactor] = useState<number>(DEFAULT_RELATIVE_ZOOM_IN_FACTOR);
  const [zoomLevelOutEffective, setZoomLevelOutEffective] = useState<number>(DEFAULT_ZOOM_LEVEL_OUT_EFFECTIVE);
  const [fileError, setFileError] = useState<string | null>(null);

  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeImageRef = useRef<HTMLImageElement | null>(null); 
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { ffmpeg } = useFFmpeg({
    onLogMessage: (message) => {
      if (ffmpegLog === '' && message.startsWith('Loading ffmpeg-core.js...')) {
        setFfmpegLog(message);
      } else {
        setFfmpegLog(prev => `${prev}\n${message}`);
      }
    },
    onProgress: setCurrentOperationProgress, // This will now be for any ffmpeg operation (load or exec)
    onLoadedChange: setFfmpegLoaded,
    onCoreLoadingChange: setIsFFmpegCoreLoading,
  });
  
  const isLoading = isAnimating || isFFmpegCoreLoading; // Combined loading state

  const midPanZoomOptions = Array.from(
    { length: relativeZoomInFactor },
    (_, i) => i + 1
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const activeItem = activeImageIndex !== null && imageItems[activeImageIndex] ? imageItems[activeImageIndex] : null;

    if (!activeItem || !activeItem.previewUrl) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      activeImageRef.current = null;
      return;
    }

    const img = new Image();
    img.onload = () => {
      activeImageRef.current = img;
      const canvasMaxWidth = Math.min(600, window.innerWidth - 40); 
      const scale = Math.min(canvasMaxWidth / img.naturalWidth, 1);
      canvas.width = img.naturalWidth * scale;
      canvas.height = img.naturalHeight * scale;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      activeItem.points.forEach((point, index) => {
        const canvasX = (point.x / img.naturalWidth) * canvas.width;
        const canvasY = (point.y / img.naturalHeight) * canvas.height;
        ctx.beginPath();
        ctx.arc(canvasX, canvasY, 5, 0, 2 * Math.PI);
        ctx.fillStyle = index === 0 ? 'red' : 'blue';
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = 'white';
        ctx.font = '12px Arial';
        ctx.fillText(`P${index + 1}`, canvasX + 8, canvasY + 4);
      });
    };
    img.onerror = () => {
      setFileError(`Could not load image preview for item: ${activeItem.file.name}`);
      // Potentially remove the item or mark it as invalid
    }
    img.src = activeItem.previewUrl;

  }, [activeImageIndex, imageItems]);


  const handleImageUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    const files = event.target.files;
    if (!files || files.length === 0) {
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
    }
    const currentImageItemsLength = imageItems.length;

    const fileProcessingPromises = Array.from(files).map(file => {
        return new Promise<ImageItem | null>((resolve) => {
            if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
                setFileError(prev => {
                    const errorMsg = `File ${file.name} is too large (max ${MAX_FILE_SIZE_MB}MB). Skipped.`;
                    return prev ? prev + "\n" + errorMsg : errorMsg;
                });
                resolve(null);
                return;
            }
            const newId = uuidv4();
            const previewUrl = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => {
                const newItem: ImageItem = {
                    id: newId,
                    file,
                    previewUrl,
                    points: [],
                    naturalWidth: img.naturalWidth,
                    naturalHeight: img.naturalHeight,
                };
                resolve(newItem);
            };
            img.onerror = () => {
                setFileError(prev => {
                    const errorMsg = `Could not load ${file.name}. Skipped.`;
                    return prev ? prev + "\n" + errorMsg : errorMsg;
                });
                URL.revokeObjectURL(previewUrl);
                resolve(null);
            };
            img.src = previewUrl;
        });
    });

    Promise.all(fileProcessingPromises).then(results => {
        const successfullyProcessedItems = results.filter(item => item !== null) as ImageItem[];
        if (successfullyProcessedItems.length > 0) {
            setImageItems(prevItems => {
                const updatedItems = [...prevItems, ...successfullyProcessedItems];
                if (activeImageIndex === null && updatedItems.length > 0) { 
                    setActiveImageIndex(currentImageItemsLength); 
                }
                return updatedItems;
            });
        }
    }).catch(error => {
        console.error("Error processing files batch:", error);
        setFileError(prev => (prev ? prev + "\n" : "") + "An unexpected error occurred while processing files.");
    });
    setVideoUrl('');
    setOverallProgress(0);
    setCurrentOperationProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [activeImageIndex, imageItems.length]);

  const handleCanvasClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeImageIndex === null || !activeImageRef.current || !canvasRef.current || !imageItems[activeImageIndex]) return;
    const activeItem = imageItems[activeImageIndex];
    if (activeItem.points.length >= 2) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = activeImageRef.current.naturalWidth / canvas.width;
    const scaleY = activeImageRef.current.naturalHeight / canvas.height;
    const canvasX = event.clientX - rect.left;
    const canvasY = event.clientY - rect.top;
    const originalX = Math.round(canvasX * scaleX);
    const originalY = Math.round(canvasY * scaleY);
    const willCompletePointsWithThisClick = activeItem.points.length === 1;

    setImageItems(prevItems =>
      prevItems.map((item, index) =>
        index === activeImageIndex
          ? { ...item, points: [...item.points, { x: originalX, y: originalY }] }
          : item
      )
    );
    if (willCompletePointsWithThisClick) {
        const nextIndex = activeImageIndex + 1;
        if (nextIndex < imageItems.length) setActiveImageIndex(nextIndex);
    }
  }, [activeImageIndex, imageItems]);

  const handleAnimate = useCallback(async () => {
    if (!imageItems.length || !ffmpegLoaded) {
      alert('Please upload at least one image and ensure FFmpeg is loaded.');
      return;
    }
    if (imageItems.some(item => item.points.length < 2)) {
      alert('All images must have two points selected.');
      return;
    }
     if (relativeZoomInFactor < 2 || zoomLevelOutEffective < 1 || zoomLevelOutEffective > relativeZoomInFactor) {
      alert('Invalid zoom factor selection. Please check your choices.');
      return;
    }
    if (relativeZoomInFactor <= zoomLevelOutEffective && DURATION_ZOOM_OUT > 0) {
        setFfmpegLog(prev => prev + `\nWarning: Initial/Final zoom (${relativeZoomInFactor}x) is not greater than Mid-Pan zoom (${zoomLevelOutEffective}x). This will result in zooming *in* or staying same during the 'zoom-out' phase.`);
    }

    setIsAnimating(true);
    setVideoUrl('');
    const logLines = ffmpegLog.split('\n');
    const ffmpegLoadSuccessLine = logLines.find(line => line.includes("FFmpeg loaded successfully!"));
    let initialLog = ffmpegLoadSuccessLine ? ffmpegLoadSuccessLine : "FFmpeg core status unknown";
    initialLog += '\nStarting animation process...';
    setFfmpegLog(initialLog);
    
    setFfmpegLog(prev => prev + `\nUser Zoom Settings: Initial/Final=${relativeZoomInFactor}x, Mid-Pan=${zoomLevelOutEffective}x`);
    setOverallProgress(0);
    setCurrentOperationProgress(0);

    const tempClipNames: string[] = [];
    const tempInputFileNames: string[] = [];
    const totalOperations = imageItems.length + (imageItems.length > 1 ? imageItems.length - 1 : 0);
    let completedOperations = 0;
    let currentVideoFile = "";

    try {
      for (let i = 0; i < imageItems.length; i++) {
        const item = imageItems[i];
        setCurrentTaskDescription(`Processing clip ${i + 1}/${imageItems.length}: ${item.file.name}`);
        setCurrentOperationProgress(0);

        let extension = getFileExtension(item.file.name);
         if (!extension) {
            if (item.file.type.startsWith('image/')) {
                extension = item.file.type.substring('image/'.length);
                if (extension === 'jpeg') extension = 'jpg';
            } else {
                extension = 'png'; 
                setFfmpegLog(prev => prev + `\nWarning: Could not determine image extension for ${item.file.name}, defaulting to .png.`);
            }
        }
        const inputFileName = `input_${i}.${extension}`;
        const outputClipName = `clip_${i}.mp4`;
        tempInputFileNames.push(inputFileName);

        await ffmpeg.writeFile(inputFileName, await fetchFile(item.file));

        const itemData: AnimationItemData = {
            points: item.points,
            naturalWidth: item.naturalWidth,
            naturalHeight: item.naturalHeight,
        };
        const zoomSettings: ZoomSettings = { relativeZoomInFactor, zoomLevelOutEffective };
        
        // Using the shared function
        const { filterGraph, logData } = generateSingleClipFilterGraph(itemData, zoomSettings);
        // setFfmpegLog(prev => prev + `\nClip ${i+1} Filter Params: ${JSON.stringify(logData, null, 2)}`); // Verbose
        
        const commandArgs = getDefaultFfmpegCommandArgs(inputFileName, filterGraph, outputClipName);
        
        setFfmpegLog(prev => prev + `\nGenerating clip ${i+1}: ffmpeg ${commandArgs.join(' ')}`);
        await ffmpeg.exec(commandArgs);
        tempClipNames.push(outputClipName);
        completedOperations++;
        setOverallProgress(completedOperations / totalOperations);
        setCurrentOperationProgress(1); // Mark this operation as done for progress UI
      }

      if (imageItems.length === 1) {
        setCurrentTaskDescription("Finalizing video...");
        setCurrentOperationProgress(0); 
        currentVideoFile = tempClipNames[0];
        const data = await ffmpeg.readFile(currentVideoFile);
        setVideoUrl(URL.createObjectURL(new Blob([(data as Uint8Array).buffer], { type: 'video/mp4' })));
        setFfmpegLog(prev => prev + '\nSingle video generated successfully!');
        setCurrentOperationProgress(1);
      } else {
        currentVideoFile = tempClipNames[0];
        let currentVideoDuration = TOTAL_DURATION_SEC;

        for (let j = 1; j < tempClipNames.length; j++) {
          setCurrentTaskDescription(`Applying transition ${j}/${tempClipNames.length - 1}`);
          setCurrentOperationProgress(0); 
          const nextClipFile = tempClipNames[j];
          const transitionedFile = `merged_${j - 1}.mp4`;
          const transitionOffset = (currentVideoDuration - TRANSITION_OVERLAP_SEC).toFixed(4);

          const xfadeCommand = [
            '-i', currentVideoFile,
            '-i', nextClipFile,
            '-filter_complex', `[0][1]xfade=transition=distance:duration=${TRANSITION_DURATION_SEC}:offset=${transitionOffset},format=yuv420p[v]`, 
            '-map', '[v]',
            '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28',
            transitionedFile
          ];
          
          setFfmpegLog(prev => prev + `\nTransition ${j} (distance effect): ffmpeg ${xfadeCommand.join(' ')}`);
          await ffmpeg.exec(xfadeCommand);

          if (j > 1) await ffmpeg.deleteFile(`merged_${j - 2}.mp4`).catch(e => console.warn("Failed to delete previous merged file", e));
          if (j === 1 && currentVideoFile === tempClipNames[0]) await ffmpeg.deleteFile(tempClipNames[0]).catch(e => console.warn("Failed to delete first clip", e));
          await ffmpeg.deleteFile(nextClipFile).catch(e => console.warn("Failed to delete next clip file", e));

          currentVideoFile = transitionedFile;
          currentVideoDuration = currentVideoDuration + TOTAL_DURATION_SEC - TRANSITION_DURATION_SEC;
          
          completedOperations++;
          setOverallProgress(completedOperations / totalOperations);
          setCurrentOperationProgress(1);
        }
        setCurrentTaskDescription("Finalizing video...");
        const data = await ffmpeg.readFile(currentVideoFile); 
        setVideoUrl(URL.createObjectURL(new Blob([(data as Uint8Array).buffer], { type: 'video/mp4' })));
        setFfmpegLog(prev => prev + '\nVideo with transitions generated successfully!');
      }

    } catch (error) {
      console.error('Error during FFmpeg processing:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setFfmpegLog(prev => prev + `\nError: ${errorMessage}`);
       if (errorMessage.includes("FS error") || errorMessage.includes("Aborted") || (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' && error.message.includes("Invalid argument"))) {
          setFfmpegLog(prev => prev + `\nFFmpeg aborted or encountered an error. This might be due to an issue with the input file, filter parameters (e.g. division by zero if a duration is 0, or invalid coordinates), or an internal FFmpeg error. Check the full log for details from FFmpeg itself.`);
          if (errorMessage.includes("Invalid argument")) {
            setFfmpegLog(prev => prev + `\nTip: 'Invalid argument' often means an expression in the filter chain evaluated to something FFmpeg didn't like (e.g., NaN, infinity, or unexpected value). Double-check point coordinates, durations, and transformed point values, especially division by zero if any duration is 0.`);
          }
      }
      alert(`An error occurred: ${errorMessage}`);
    } finally {
      setIsAnimating(false);
      setCurrentTaskDescription("");
      setCurrentOperationProgress(0);
      setFfmpegLog(prev => prev + '\nCleaning up temporary files...');
      
      for (const name of tempInputFileNames) { 
        try { await ffmpeg.deleteFile(name); } catch (e) { console.warn(`Failed to delete input file ${name}`, e); }
      }
      for (let k = 0; k < tempClipNames.length; k++) {
          if (tempClipNames[k] !== currentVideoFile) {
              try { 
                  const dataExists = await ffmpeg.readFile(tempClipNames[k]).then(() => true).catch(() => false);
                  if(dataExists) await ffmpeg.deleteFile(tempClipNames[k]);
              } catch (e) { /* Gulp */ }
          }
      }
      if (imageItems.length > 1) {
          for (let k=0; k < imageItems.length - 2; k++) { 
              const intermediateMergedFile = `merged_${k}.mp4`;
              if (intermediateMergedFile !== currentVideoFile) {
                  try { await ffmpeg.deleteFile(intermediateMergedFile); } catch (e) { /* Gulp */ }
              }
          }
      }
      setFfmpegLog(prev => prev + '\nCleanup attempt complete.');
    }
  }, [imageItems, ffmpegLoaded, relativeZoomInFactor, zoomLevelOutEffective, ffmpeg, ffmpegLog]); 

  const handleReset = useCallback(() => {
    imageItems.forEach(item => URL.revokeObjectURL(item.previewUrl));
    setImageItems([]);
    setActiveImageIndex(null);
    setVideoUrl('');
    setOverallProgress(0);
    setCurrentOperationProgress(0);
    setFileError(null);
    activeImageRef.current = null;

    setRelativeZoomInFactor(DEFAULT_RELATIVE_ZOOM_IN_FACTOR);
    setZoomLevelOutEffective(DEFAULT_ZOOM_LEVEL_OUT_EFFECTIVE);

    let resetLogMessage = "Loading ffmpeg-core.js...";
    if (ffmpegLoaded) {
        const logLines = ffmpegLog.split('\n');
        const loadSuccessLine = logLines.find(line => line.includes("FFmpeg loaded successfully!"));
        if (loadSuccessLine) {
            resetLogMessage = loadSuccessLine;
        } else {
            resetLogMessage = "FFmpeg loaded successfully!"; 
        }
    } else if(ffmpegLog.startsWith("Loading ffmpeg-core.js...")){
        const firstLineEnd = ffmpegLog.indexOf('\n');
        resetLogMessage = firstLineEnd > -1 ? ffmpegLog.substring(0, firstLineEnd) : ffmpegLog;
    }
    setFfmpegLog(resetLogMessage);

    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [ffmpegLoaded, imageItems, ffmpegLog]);

  const handleItemAction = (id: string, action: 'setActive' | 'resetPoints' | 'remove') => {
    const itemIndex = imageItems.findIndex(item => item.id === id);
    if (itemIndex === -1) return;

    switch (action) {
      case 'setActive': setActiveImageIndex(itemIndex); break;
      case 'resetPoints': setImageItems(prev => prev.map(item => item.id === id ? { ...item, points: [] } : item)); break;
      case 'remove': {
            const itemToRemove = imageItems[itemIndex];
            if (itemToRemove) URL.revokeObjectURL(itemToRemove.previewUrl);
            const newItems = imageItems.filter(item => item.id !== id);
            setImageItems(newItems);
            if (activeImageIndex === itemIndex) {
                if (newItems.length === 0) setActiveImageIndex(null);
                else if (itemIndex >= newItems.length) setActiveImageIndex(newItems.length - 1);
                else setActiveImageIndex(itemIndex < newItems.length ? itemIndex : newItems.length - 1);
            } else if (activeImageIndex !== null && activeImageIndex > itemIndex) {
                setActiveImageIndex(prevIdx => prevIdx! - 1);
            }
        }
        break;
    }
  };
  
  const handleInitialZoomChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newInitialZoom = parseInt(e.target.value, 10);
    setRelativeZoomInFactor(newInitialZoom);
    if (zoomLevelOutEffective > newInitialZoom) setZoomLevelOutEffective(1); 
  };

  const handleMidPanZoomChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setZoomLevelOutEffective(parseInt(e.target.value, 10));
  };

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, id: string) => {
    if (isLoading) return;
    e.dataTransfer.setData('application/image-item-id', id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedItemId(id);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (isLoading) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>, targetId: string) => {
    if (isLoading) return;
    e.preventDefault();
    if (targetId !== draggedItemId) setDragOverItemId(targetId);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    if (isLoading) return; e.preventDefault(); setDragOverItemId(null);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetItemId: string) => {
    if (isLoading) return;
    e.preventDefault();
    const currentDraggedItemId = e.dataTransfer.getData('application/image-item-id');
    setDraggedItemId(null); setDragOverItemId(null);
    if (!currentDraggedItemId || currentDraggedItemId === targetItemId) return;

    setImageItems(prevItems => {
      const draggedItemIndex = prevItems.findIndex(item => item.id === currentDraggedItemId);
      let targetItemIndex = prevItems.findIndex(item => item.id === targetItemId);
      if (draggedItemIndex === -1 || targetItemIndex === -1) return prevItems;
      const newItems = [...prevItems];
      const [draggedItem] = newItems.splice(draggedItemIndex, 1);
      targetItemIndex = newItems.findIndex(item => item.id === targetItemId); // Re-find index in modified array
      if (draggedItemIndex < targetItemIndex) newItems.splice(targetItemIndex + 1, 0, draggedItem);
      else newItems.splice(targetItemIndex, 0, draggedItem);
      
      const prevActiveItemId = activeImageIndex !== null ? prevItems[activeImageIndex]?.id : null;
      if (prevActiveItemId) {
        const newActiveIdx = newItems.findIndex(i => i.id === prevActiveItemId);
        setActiveImageIndex(newActiveIdx !== -1 ? newActiveIdx : null);
      }
      return newItems;
    });
  };

  const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    if (isLoading) return; setDraggedItemId(null); setDragOverItemId(null);
  };

  return (
    <div className="max-w-5xl mx-auto p-6 bg-gray-700 shadow-lg rounded-lg text-gray-200">
      <h2 className="text-2xl font-bold text-orange-400 mb-2">Multi-Image Animator</h2>
      <p className="text-gray-300 mb-6">
        Upload images, select points, reorder, and animate. Output: {OUTPUT_WIDTH}x{OUTPUT_HEIGHT} @ {FPS}fps. 
        Clip: {TOTAL_DURATION_SEC.toFixed(2)}s. Transition: {TRANSITION_DURATION_SEC}s. Upscale: {PRE_ZOOMPAN_UPSCALE_FACTOR}x.
      </p>

      <div className="mb-4">
        <label htmlFor="imageUploadAnimatorMulti" className="sr-only">Choose images</label>
        <input type="file" id="imageUploadAnimatorMulti" ref={fileInputRef} accept="image/*" multiple onChange={handleImageUpload} disabled={isLoading}
          className="block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-orange-500 file:text-gray-100 hover:file:bg-orange-600 disabled:opacity-50"
        />
        {fileError && <p className="mt-2 text-sm text-red-400 whitespace-pre-line" role="alert">{fileError}</p>}
      </div>
      
      {isFFmpegCoreLoading && !ffmpegLoaded && (
         <div className="my-4 p-3 bg-blue-900 text-blue-100 rounded-md">
            Loading FFmpeg core...
            <div className="w-full bg-gray-600 rounded-full h-2.5 mt-2"><div className="bg-orange-500 h-2.5 rounded-full animate-pulse" style={{ width: `100%`}}></div></div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4 border border-gray-600 rounded-md">
        <div>
          <label htmlFor="initialZoomFactorMulti" className="block text-sm font-medium text-gray-300 mb-1">Initial/Final Zoom:</label>
          <select id="initialZoomFactorMulti" value={relativeZoomInFactor} onChange={handleInitialZoomChange} disabled={isLoading} className="w-full p-2.5 rounded bg-gray-600 border border-gray-500 focus:ring-orange-500 focus:border-orange-500 text-gray-100">
            {INITIAL_ZOOM_OPTIONS.map(zoom => (<option key={zoom} value={zoom}>{zoom}x Zoom</option>))}
          </select>
          <p className="text-xs text-gray-400 mt-1">Zoom level at start and end of each clip segment.</p>
        </div>
        <div>
          <label htmlFor="midPanZoomFactorMulti" className="block text-sm font-medium text-gray-300 mb-1">Mid-Pan Zoom:</label>
          <select id="midPanZoomFactorMulti" value={zoomLevelOutEffective} onChange={handleMidPanZoomChange} disabled={isLoading} className="w-full p-2.5 rounded bg-gray-600 border border-gray-500 focus:ring-orange-500 focus:border-orange-500 text-gray-100">
            {midPanZoomOptions.map(zoom => (<option key={zoom} value={zoom}>{zoom}x Zoom</option>))}
          </select>
          <p className="text-xs text-gray-400 mt-1">Zoom level during pan. Cannot exceed Initial/Final Zoom.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-3 max-h-96 overflow-y-auto pr-2 bg-gray-800 p-3 rounded-md border border-gray-600">
          <h3 className="text-lg font-semibold text-orange-400 mb-2">Image Queue ({imageItems.length})</h3>
          {imageItems.length === 0 && <p className="text-sm text-gray-400">No images uploaded yet.</p>}
          {imageItems.map((item, index) => (
            <div key={item.id} draggable={!isLoading} onDragStart={(e) => handleDragStart(e, item.id)} onDragOver={handleDragOver} onDragEnter={(e) => handleDragEnter(e, item.id)} onDragLeave={handleDragLeave} onDrop={(e) => handleDrop(e, item.id)} onDragEnd={handleDragEnd}
              onClick={(e) => { if ((e.target as HTMLElement).closest('button') || isLoading) return; handleItemAction(item.id, 'setActive'); }}
              className={`p-2.5 rounded-md border shadow transition-all duration-150 ease-in-out
                ${activeImageIndex === index ? 'border-orange-500 bg-gray-700' : 'border-gray-600 bg-gray-750 hover:bg-gray-700'}
                ${draggedItemId === item.id ? 'opacity-40' : ''}
                ${dragOverItemId === item.id && draggedItemId !== item.id ? 'ring-2 ring-offset-1 ring-offset-gray-800 ring-blue-400 border-blue-400' : ''}
                ${!isLoading ? 'cursor-grab' : 'cursor-default'}`}
            >
              <div className="flex items-center space-x-2">
                <img src={item.previewUrl} alt={`Preview ${item.file.name}`} className="w-16 h-16 object-cover rounded-sm flex-shrink-0 pointer-events-none"/>
                <div className="flex-grow text-xs overflow-hidden pointer-events-none">
                  <p className="font-medium text-gray-200 truncate" title={item.file.name}>{index+1}. {item.file.name}</p>
                  <p className="text-gray-400">Points: {item.points.length}/2</p>
                  <p className="text-gray-400">Dim: {item.naturalWidth}x{item.naturalHeight}</p>
                </div>
              </div>
              <div className="mt-2.5 flex space-x-1">
                <button onClick={() => handleItemAction(item.id, 'resetPoints')} className="flex-1 py-1 text-xs bg-yellow-500 hover:bg-yellow-600 text-gray-900 rounded disabled:opacity-50" disabled={isLoading}>Reset Pts</button>
                <button onClick={() => handleItemAction(item.id, 'remove')} className="flex-1 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded disabled:opacity-50" disabled={isLoading}>Remove</button>
              </div>
            </div>
          ))}
        </div>

        <div className="md:col-span-2">
          {activeImageIndex !== null && imageItems[activeImageIndex] ? (
            <div>
              <p className="text-gray-300 mb-2">Editing: <span className="font-semibold text-orange-300">{imageItems[activeImageIndex].file.name}</span>. {imageItems[activeImageIndex].points.length < 2 ? "Click P1 then P2." : "Points selected."}</p>
              <canvas ref={canvasRef} onClick={handleCanvasClick} className={`border border-gray-500 max-w-full rounded ${imageItems[activeImageIndex]?.points.length < 2 ? 'cursor-crosshair' : 'cursor-default'} bg-black`}
                style={{ maxHeight: '70vh', aspectRatio: imageItems[activeImageIndex] ? `${imageItems[activeImageIndex].naturalWidth}/${imageItems[activeImageIndex].naturalHeight}` : '16/9' }}
              />
              {imageItems[activeImageIndex]?.points.length > 0 && (
                <div className="mt-2 text-sm text-gray-300">
                  <h4 className="font-semibold text-orange-400">Selected Points (Original Coords):</h4>
                  {imageItems[activeImageIndex].points.map((p, i) => <p key={i}>P{i+1}: ({p.x}, {p.y})</p>)}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 bg-gray-800 border border-gray-500 rounded-md"><p className="text-gray-400 text-center">{imageItems.length > 0 ? "Select an image." : "Upload images."}</p></div>
          )}
        </div>
      </div>

      <div className="my-6 space-x-3">
        <button onClick={handleAnimate} disabled={isLoading || !ffmpegLoaded || imageItems.length === 0 || imageItems.some(item => item.points.length < 2)} className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors">
          {isAnimating ? 'Animating...' : 'Animate All!'}
        </button>
        <button onClick={handleReset} disabled={isAnimating} className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded disabled:bg-gray-500 disabled:opacity-70 transition-colors">
          Reset All
        </button>
      </div>

      {isAnimating && ( // Show progress only when animating, not during core load
         <div className="my-4">
            {currentTaskDescription && <p className="text-sm text-orange-300 mb-1">{currentTaskDescription}</p>}
            {imageItems.length > 1 && ( 
                <>
                    <p className="text-sm text-orange-400 mb-1">Overall Progress: {(overallProgress * 100).toFixed(0)}%</p>
                    <div className="w-full bg-gray-600 rounded-full h-2.5 mb-2"><div className="bg-green-500 h-2.5 rounded-full" style={{ width: `${(overallProgress * 100).toFixed(0)}%` }}></div></div>
                </>
            )}
            <p className="text-sm text-orange-400 mb-1">Current Operation Progress: {(currentOperationProgress * 100).toFixed(0)}%</p>
            <div className="w-full bg-gray-600 rounded-full h-2.5"><div className="bg-orange-500 h-2.5 rounded-full" style={{ width: `${(currentOperationProgress * 100).toFixed(0)}%` }}></div></div>
        </div>
      )}

      {videoUrl && (
        <div className="my-6">
          <h3 className="text-xl font-semibold text-orange-400 mb-3">Generated Video:</h3>
          <video src={videoUrl} controls width={OUTPUT_WIDTH / 2.5} height={OUTPUT_HEIGHT / 2.5} className="rounded border border-gray-500"/>
          <a href={videoUrl} download="animated_images_video.mp4" className="mt-3 inline-block bg-orange-500 hover:bg-orange-600 text-gray-100 py-2 px-4 rounded transition-colors">Download Video</a>
        </div>
      )}

      {ffmpegLog && (
        <div className="mt-6">
          <h4 className="text-md font-semibold text-orange-400 mb-1">FFmpeg Log:</h4>
          <pre className="bg-gray-900 text-xs text-gray-300 p-3 rounded-md max-h-60 overflow-y-auto whitespace-pre-wrap break-all border border-gray-600">{ffmpegLog}</pre>
        </div>
      )}
    </div>
  );
}

export default MultiImageAnimatorPage;