// src/pages/ImageAnimatorPage.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { FFmpeg, type ProgressEvent } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { v4 as uuidv4 } from 'uuid';

// --- Configuration Constants ---
const OUTPUT_WIDTH = 720;
const OUTPUT_HEIGHT = 1280;
const FPS = 60;
const MAX_FILE_SIZE_MB = 20;

const PRE_ZOOMPAN_UPSCALE_FACTOR = 8;
const OVERSCAN_BORDER_FACTOR = 1.5;

const DEFAULT_RELATIVE_ZOOM_IN_FACTOR = 6;
const DEFAULT_ZOOM_LEVEL_OUT_EFFECTIVE = 2;

const INITIAL_ZOOM_OPTIONS = [2, 3, 4, 5, 6, 7, 8, 9, 10];

const DURATION_HOLD_START = 0.05;
const DURATION_ZOOM_OUT = 0.90;
const DURATION_PAN = 1.0;
const DURATION_ZOOM_IN = 0.90;
const DURATION_HOLD_END = 0.05;

const TOTAL_DURATION_SEC =
  DURATION_HOLD_START +
  DURATION_ZOOM_OUT +
  DURATION_PAN +
  DURATION_ZOOM_IN +
  DURATION_HOLD_END;

const TRANSITION_DURATION_SEC = 0.5; // Total duration of transition
const TRANSITION_OVERLAP_SEC = 0.25; // Overlap from each clip into the transition

// --- TypeScript Interfaces ---
interface Point {
  x: number;
  y: number;
}

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
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [ffmpegLog, setFfmpegLog] = useState<string>('');
  const [ffmpegLoaded, setFfmpegLoaded] = useState<boolean>(false);
  
  const [currentOperationProgress, setCurrentOperationProgress] = useState(0); // 0-1 for current ffmpeg task
  const [overallProgress, setOverallProgress] = useState(0); // 0-1 for all tasks
  const [currentTaskDescription, setCurrentTaskDescription] = useState("");

  const [relativeZoomInFactor, setRelativeZoomInFactor] = useState<number>(DEFAULT_RELATIVE_ZOOM_IN_FACTOR);
  const [zoomLevelOutEffective, setZoomLevelOutEffective] = useState<number>(DEFAULT_ZOOM_LEVEL_OUT_EFFECTIVE);
  const [fileError, setFileError] = useState<string | null>(null);

  // For Drag and Drop
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);


  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeImageRef = useRef<HTMLImageElement | null>(null); // For canvas drawing
  const ffmpegRef = useRef(new FFmpeg());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const midPanZoomOptions = Array.from(
    { length: relativeZoomInFactor },
    (_, i) => i + 1
  );

  // Load FFmpeg
  useEffect(() => {
    const loadFFmpeg = async () => {
      setIsLoading(true);
      setCurrentTaskDescription("Loading FFmpeg...");
      setFfmpegLog('Loading ffmpeg-core.js...');
      const ffmpeg = ffmpegRef.current;
      ffmpeg.on('log', ({ message }: { type: string; message: string }) => {
        if (!message.startsWith("frame=") && !message.startsWith("size=") && !message.includes("pts_time")) {
          setFfmpegLog(prev => `${prev}\n${message}`);
        }
      });
      ffmpeg.on('progress', (event: ProgressEvent) => {
        if (event.progress >= 0) { 
          setCurrentOperationProgress(event.progress);
        }
      });

      try {
        const coreURL = await toBlobURL('https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js', 'text/javascript');
        const wasmURL = await toBlobURL('https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.wasm', 'application/wasm');
        await ffmpeg.load({ coreURL, wasmURL });
        setFfmpegLog(prev => prev + '\nFFmpeg loaded successfully!');
        setFfmpegLoaded(true);
      } catch (err) {
        console.error("FFmpeg load error:", err);
        setFfmpegLog(prev => prev + `\nError loading FFmpeg: ${err instanceof Error ? err.message : String(err)}`);
        alert("Failed to load FFmpeg. Check console for details.");
      } finally {
        setIsLoading(false);
        setCurrentTaskDescription("");
      }
    };
    loadFFmpeg();
  }, []);

  // Draw active image and its points on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const activeItem = activeImageIndex !== null && imageItems[activeImageIndex] ? imageItems[activeImageIndex] : null;

    if (!activeItem || !activeItem.previewUrl) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      activeImageRef.current = null;
      if (canvasRef.current) {
        const context = canvasRef.current.getContext('2d');
        context?.clearRect(0,0,canvasRef.current.width, canvasRef.current.height);
      }
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
    }
    img.src = activeItem.previewUrl;

  }, [activeImageIndex, imageItems]);


  const handleImageUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    const files = event.target.files;
    if (!files || files.length === 0) {
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
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

    if (fileInputRef.current) {
        fileInputRef.current.value = "";
    }
  }, [activeImageIndex, imageItems.length]);

  const handleCanvasClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeImageIndex === null || !activeImageRef.current || !canvasRef.current || !imageItems[activeImageIndex]) return;
    
    const activeItem = imageItems[activeImageIndex];
    
    // If the active item already has 2 points, do nothing further (don't add more points or auto-advance).
    if (activeItem.points.length >= 2) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = activeImageRef.current.naturalWidth / canvas.width;
    const scaleY = activeImageRef.current.naturalHeight / canvas.height;

    const canvasX = event.clientX - rect.left;
    const canvasY = event.clientY - rect.top;

    const originalX = Math.round(canvasX * scaleX);
    const originalY = Math.round(canvasY * scaleY);

    // Check if this click will complete the points for the current item (i.e., it currently has 1 point).
    const willCompletePointsWithThisClick = activeItem.points.length === 1;

    setImageItems(prevItems =>
      prevItems.map((item, index) =>
        index === activeImageIndex
          ? { ...item, points: [...item.points, { x: originalX, y: originalY }] }
          : item
      )
    );

    // If points were just completed for this item with this click,
    // and there's a next image in the queue, advance to it.
    if (willCompletePointsWithThisClick) {
        const nextIndex = activeImageIndex + 1;
        if (nextIndex < imageItems.length) {
            setActiveImageIndex(nextIndex);
        }
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

    setIsLoading(true);
    setVideoUrl('');
    setFfmpegLog(prev => { 
        const lines = prev.split('\n');
        const loadSuccessLine = lines.find(line => line.includes("FFmpeg loaded successfully!"));
        return (loadSuccessLine ? loadSuccessLine : "FFmpeg core status unknown") + '\nStarting animation process...';
    });
    setFfmpegLog(prev => prev + `\nUser Zoom Settings: Initial/Final=${relativeZoomInFactor}x, Mid-Pan=${zoomLevelOutEffective}x`);
    setOverallProgress(0);
    setCurrentOperationProgress(0);

    const ffmpeg = ffmpegRef.current;
    const tempClipNames: string[] = [];
    const tempInputFileNames: string[] = [];

    const totalOperations = imageItems.length + (imageItems.length > 1 ? imageItems.length - 1 : 0);
    let completedOperations = 0;

    const getFileExtension = (filename: string): string => {
      const lastDot = filename.lastIndexOf(".");
      if (lastDot === -1 || lastDot === 0 || lastDot === filename.length - 1) return '';
      return filename.slice(lastDot + 1).toLowerCase();
    };

    let currentVideoFile = ""; // Keep track of the latest merged video file

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

        const orig_iw = item.naturalWidth;
        const orig_ih = item.naturalHeight;
        if (orig_iw === 0 || orig_ih === 0) throw new Error(`Image ${item.file.name} has zero dimensions.`);

        const p1_orig = item.points[0];
        const p2_orig = item.points[1];
        const totalFrames = Math.round(TOTAL_DURATION_SEC * FPS);

        const IC_WIDTH = OUTPUT_WIDTH * PRE_ZOOMPAN_UPSCALE_FACTOR;
        const IC_HEIGHT = OUTPUT_HEIGHT * PRE_ZOOMPAN_UPSCALE_FACTOR;
        const ic_scale_factor = Math.min(IC_WIDTH / orig_iw, IC_HEIGHT / orig_ih);
        const ic_pad_x = (IC_WIDTH - (orig_iw * ic_scale_factor)) / 2;
        const ic_pad_y = (IC_HEIGHT - (orig_ih * ic_scale_factor)) / 2;

        const p1_ic_transformed = { x: p1_orig.x * ic_scale_factor + ic_pad_x, y: p1_orig.y * ic_scale_factor + ic_pad_y };
        const p2_ic_transformed = { x: p2_orig.x * ic_scale_factor + ic_pad_x, y: p2_orig.y * ic_scale_factor + ic_pad_y };

        const min_zoom_for_border_calc = Math.max(1, zoomLevelOutEffective);
        const PAD_X_BORDER = Math.ceil((IC_WIDTH / min_zoom_for_border_calc) / 2);
        const PAD_Y_BORDER = Math.ceil((IC_HEIGHT / min_zoom_for_border_calc) / 2);
        const ZPI_WIDTH = IC_WIDTH + 2 * PAD_X_BORDER;
        const ZPI_HEIGHT = IC_HEIGHT + 2 * PAD_Y_BORDER;

        const p1_zpi_transformed_x = parseFloat((p1_ic_transformed.x + PAD_X_BORDER).toFixed(4));
        const p1_zpi_transformed_y = parseFloat((p1_ic_transformed.y + PAD_Y_BORDER).toFixed(4));
        const p2_zpi_transformed_x = parseFloat((p2_ic_transformed.x + PAD_X_BORDER).toFixed(4));
        const p2_zpi_transformed_y = parseFloat((p2_ic_transformed.y + PAD_Y_BORDER).toFixed(4));
        
        const f_hold_start_end = Math.round(DURATION_HOLD_START * FPS);
        const f_zoom_out_end = f_hold_start_end + Math.round(DURATION_ZOOM_OUT * FPS);
        const f_pan_end = f_zoom_out_end + Math.round(DURATION_PAN * FPS);
        
        const currentRelativeZoomIn = parseFloat(relativeZoomInFactor.toFixed(4));
        const currentZoomOutEffectiveValue = parseFloat((zoomLevelOutEffective * OVERSCAN_BORDER_FACTOR).toFixed(4));

        const zoomExpr =
          `if(lt(on,${f_hold_start_end}),${currentRelativeZoomIn},` +
          `if(lt(on,${f_zoom_out_end}),${currentRelativeZoomIn} - (${currentRelativeZoomIn}-${currentZoomOutEffectiveValue})*(on-${f_hold_start_end})/(${Math.max(1, DURATION_ZOOM_OUT*FPS)}),` + 
          `if(lt(on,${f_pan_end}),${currentZoomOutEffectiveValue},` +
          `if(lt(on,${f_pan_end + Math.round(DURATION_ZOOM_IN * FPS)}),${currentZoomOutEffectiveValue} + (${currentRelativeZoomIn}-${currentZoomOutEffectiveValue})*(on-${f_pan_end})/(${Math.max(1,DURATION_ZOOM_IN*FPS)}),` + 
          `${currentRelativeZoomIn}))))`;

        const targetXTimelineExpr_zpi =
          `if(lt(on,${f_zoom_out_end}),${p1_zpi_transformed_x},` +
          `if(lt(on,${f_pan_end}),${p1_zpi_transformed_x} + (${p2_zpi_transformed_x}-${p1_zpi_transformed_x})*(on-${f_zoom_out_end})/(${Math.max(1,DURATION_PAN*FPS)}),` + 
          `${p2_zpi_transformed_x}))`;

        const targetYTimelineExpr_zpi =
          `if(lt(on,${f_zoom_out_end}),${p1_zpi_transformed_y},` +
          `if(lt(on,${f_pan_end}),${p1_zpi_transformed_y} + (${p2_zpi_transformed_y}-${p1_zpi_transformed_y})*(on-${f_zoom_out_end})/(${Math.max(1,DURATION_PAN*FPS)}),` + 
          `${p2_zpi_transformed_y}))`;

        const zoompanXExpr = `round((${targetXTimelineExpr_zpi}) - ((${IC_WIDTH})/(${zoomExpr}))/2)`;
        const zoompanYExpr = `round((${targetYTimelineExpr_zpi}) - ((${IC_HEIGHT})/(${zoomExpr}))/2)`;
        
        const filterGraph =
          `scale=w=${IC_WIDTH}:h=${IC_HEIGHT}:force_original_aspect_ratio=decrease,` +
          `pad=width=${IC_WIDTH}:height=${IC_HEIGHT}:x='(ow-iw)/2':y='(oh-ih)/2':color=black,` +
          `pad=width=${ZPI_WIDTH}:height=${ZPI_HEIGHT}:x=${PAD_X_BORDER}:y=${PAD_Y_BORDER}:color=black,` +
          `zoompan=z='${zoomExpr}':x='${zoompanXExpr}':y='${zoompanYExpr}':d=${totalFrames}:s=${OUTPUT_WIDTH}x${OUTPUT_HEIGHT}:fps=${FPS},` +
          `format=yuv420p`;

        const command = ['-i', inputFileName, '-vf', filterGraph, '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28', '-t', TOTAL_DURATION_SEC.toString(), outputClipName];
        
        setFfmpegLog(prev => prev + `\nGenerating clip ${i+1}: ffmpeg ${command.join(' ')}`);
        await ffmpeg.exec(command);
        tempClipNames.push(outputClipName);
        completedOperations++;
        setOverallProgress(completedOperations / totalOperations);
      }

      if (imageItems.length === 1) {
        setCurrentTaskDescription("Finalizing video...");
        setCurrentOperationProgress(0); 
        currentVideoFile = tempClipNames[0];
        const data = await ffmpeg.readFile(currentVideoFile);
        setVideoUrl(URL.createObjectURL(new Blob([(data as Uint8Array).buffer], { type: 'video/mp4' })));
        setFfmpegLog(prev => prev + '\nSingle video generated successfully!');
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
            '-c:v', 'libx264',
            '-preset', 'ultrafast',
            '-crf', '28',
            transitionedFile
          ];
          
          setFfmpegLog(prev => prev + `\nTransition ${j} (distance effect): ffmpeg ${xfadeCommand.join(' ')}`);
          await ffmpeg.exec(xfadeCommand);

          // Clean up previous files
          if (j > 1) { // Not the first merge, so a previous merged file exists
             try { await ffmpeg.deleteFile(`merged_${j - 2}.mp4`); } catch(e){ console.warn("Failed to delete previous merged file", e)}
          }
           // Delete the first individual clip after its first use in merge
          if (j === 1 && currentVideoFile === tempClipNames[0]) { 
            try { await ffmpeg.deleteFile(tempClipNames[0]); } catch(e){ console.warn("Failed to delete first clip", e)}
          }
          // Delete the "nextClipFile" as it's now part of the new merged file
           try { await ffmpeg.deleteFile(nextClipFile); } catch(e){ console.warn("Failed to delete next clip file", e)} 

          currentVideoFile = transitionedFile;
          currentVideoDuration = currentVideoDuration + TOTAL_DURATION_SEC - TRANSITION_DURATION_SEC;
          
          completedOperations++;
          setOverallProgress(completedOperations / totalOperations);
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
      setIsLoading(false);
      setCurrentTaskDescription("");
      setCurrentOperationProgress(0);
      setFfmpegLog(prev => prev + '\nCleaning up temporary files...');
      
      // Clean up individual input files
      for (const name of tempInputFileNames) { 
        try { await ffmpeg.deleteFile(name); } catch (e) { console.warn(`Failed to delete input file ${name}`, e); }
      }
      
      // Clean up individual clip_i.mp4 files (if not the final video and not already deleted)
      for (let k = 0; k < tempClipNames.length; k++) {
          if (tempClipNames[k] !== currentVideoFile) { // Don't delete if it's the final output
              let alreadyDeletedDuringMerge = false;
              if (imageItems.length > 1) {
                  if (k === 0 && `merged_0.mp4` === currentVideoFile ) { // first clip used in first merge
                    // it would have been deleted if `currentVideoFile` was `tempClipNames[0]` and j === 1
                  } else if (k > 0) { // other clips were deleted as `nextClipFile`
                    // this condition is a bit complex due to iterative merging, so a simple try-catch is safer
                  }
              }
              try { 
                  // A more robust check: if tempClipNames[k] is NOT currentVideoFile, and not videoUrl (meaning it's an intermediate)
                  const dataExists = await ffmpeg.readFile(tempClipNames[k]).then(() => true).catch(() => false);
                  if(dataExists && tempClipNames[k] !== currentVideoFile) {
                    await ffmpeg.deleteFile(tempClipNames[k]);
                  }
              } catch (e) { /* Gulp: File might have been deleted during merging process */ }
          }
      }

      // Clean up intermediate merged files (merged_0.mp4, merged_1.mp4, etc.)
      // The final `currentVideoFile` (e.g., merged_N-1.mp4) should NOT be deleted here if it's what videoUrl is based on.
      if (imageItems.length > 1) {
          for (let k=0; k < imageItems.length - 2; k++) { // Iterate up to the second to last possible merge
              const intermediateMergedFile = `merged_${k}.mp4`;
              if (intermediateMergedFile !== currentVideoFile) { // Don't delete if it became the final file
                  try { await ffmpeg.deleteFile(intermediateMergedFile); } catch (e) { /* Gulp */ }
              }
          }
      }
      setFfmpegLog(prev => prev + '\nCleanup attempt complete.');
    }
  }, [imageItems, ffmpegLoaded, relativeZoomInFactor, zoomLevelOutEffective]); 

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
      case 'setActive':
        setActiveImageIndex(itemIndex);
        break;
      case 'resetPoints':
        setImageItems(prev => prev.map(item => item.id === id ? { ...item, points: [] } : item));
        break;
      case 'remove':
        {
            const itemToRemove = imageItems[itemIndex];
            if (itemToRemove) URL.revokeObjectURL(itemToRemove.previewUrl);

            const newItems = imageItems.filter(item => item.id !== id);
            setImageItems(newItems);

            if (activeImageIndex === itemIndex) {
                if (newItems.length === 0) {
                    setActiveImageIndex(null);
                } else if (itemIndex >= newItems.length) { 
                    setActiveImageIndex(newItems.length - 1);
                } else { 
                    // If the removed item was active, and there are still items at or after its original position,
                    // the new item at that position becomes active.
                    // This usually means the index stays the same unless it was the last item.
                    setActiveImageIndex(itemIndex < newItems.length ? itemIndex : newItems.length - 1);
                }
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
    if (zoomLevelOutEffective > newInitialZoom) {
      setZoomLevelOutEffective(1); 
    }
  };

  const handleMidPanZoomChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setZoomLevelOutEffective(parseInt(e.target.value, 10));
  };

  // --- Drag and Drop Handlers ---
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
    if (targetId !== draggedItemId) {
        setDragOverItemId(targetId);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    if (isLoading) return;
    e.preventDefault();
    setDragOverItemId(null);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetItemId: string) => {
    if (isLoading) return;
    e.preventDefault();
    const currentDraggedItemId = e.dataTransfer.getData('application/image-item-id');
    setDraggedItemId(null);
    setDragOverItemId(null);

    if (!currentDraggedItemId || currentDraggedItemId === targetItemId) {
      return;
    }

    setImageItems(prevItems => {
      const draggedItemIndex = prevItems.findIndex(item => item.id === currentDraggedItemId);
      let targetItemIndex = prevItems.findIndex(item => item.id === targetItemId);

      if (draggedItemIndex === -1 || targetItemIndex === -1) return prevItems;

      const newItems = [...prevItems];
      const [draggedItem] = newItems.splice(draggedItemIndex, 1);
      
      // Re-calculate target index in the modified array if item was moved downwards
      if (draggedItemIndex < targetItemIndex) {
         targetItemIndex = newItems.findIndex(item => item.id === targetItemId) +1; // find it in the new array and place before it
      } else {
         targetItemIndex = newItems.findIndex(item => item.id === targetItemId);
      }
      // Ensure targetItemIndex is valid after splice
      if (targetItemIndex < 0) targetItemIndex = 0; // Should not happen with valid IDs
      
      newItems.splice(targetItemIndex, 0, draggedItem);
      
      const prevActiveItemId = activeImageIndex !== null ? prevItems[activeImageIndex]?.id : null;
      if (prevActiveItemId) {
        const newActiveIdx = newItems.findIndex(i => i.id === prevActiveItemId);
        if (newActiveIdx !== -1) {
          setActiveImageIndex(newActiveIdx);
        } else {
          setActiveImageIndex(null); // Active item somehow lost, reset
        }
      }
      return newItems;
    });
  };

  const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    if (isLoading) return;
    setDraggedItemId(null);
    setDragOverItemId(null);
  };


  // --- JSX ---
  return (
    <div className="max-w-5xl mx-auto p-6 bg-gray-700 shadow-lg rounded-lg text-gray-200">
      <h2 className="text-2xl font-bold text-orange-400 mb-2">Multi-Image Animator</h2>
      <p className="text-gray-300 mb-6">
        Upload images, select points, reorder by drag-and-drop, and animate into a single video.
        Output: {OUTPUT_WIDTH}x{OUTPUT_HEIGHT} @ {FPS}fps. Clip duration: {TOTAL_DURATION_SEC.toFixed(2)}s. Transition: {TRANSITION_DURATION_SEC}s.
      </p>

      {/* File Upload */}
      <div className="mb-4">
        <label htmlFor="imageUploadAnimator" className="sr-only">Choose images</label>
        <input
          type="file"
          id="imageUploadAnimator"
          ref={fileInputRef}
          accept="image/*"
          multiple
          onChange={handleImageUpload}
          disabled={isLoading}
          className="block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-orange-500 file:text-gray-100 hover:file:bg-orange-600 disabled:opacity-50"
        />
        {fileError && <p className="mt-2 text-sm text-red-400 whitespace-pre-line" role="alert">{fileError}</p>}
      </div>
      
      {!ffmpegLoaded && isLoading && (
         <div className="my-4 p-3 bg-blue-900 text-blue-100 rounded-md">
            Loading FFmpeg core...
            <div className="w-full bg-gray-600 rounded-full h-2.5 mt-2"><div className="bg-orange-500 h-2.5 rounded-full animate-pulse" style={{ width: `100%`}}></div></div>
        </div>
      )}

      {/* Zoom Configuration */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4 border border-gray-600 rounded-md">
        <div>
          <label htmlFor="initialZoomFactor" className="block text-sm font-medium text-gray-300 mb-1">Initial/Final Zoom:</label>
          <select id="initialZoomFactor" value={relativeZoomInFactor} onChange={handleInitialZoomChange} disabled={isLoading} className="w-full p-2.5 rounded bg-gray-600 border border-gray-500 focus:ring-orange-500 focus:border-orange-500 text-gray-100">
            {INITIAL_ZOOM_OPTIONS.map(zoom => (<option key={zoom} value={zoom}>{zoom}x Zoom</option>))}
          </select>
          <p className="text-xs text-gray-400 mt-1">Zoom level at start and end of each clip segment.</p>
        </div>
        <div>
          <label htmlFor="midPanZoomFactor" className="block text-sm font-medium text-gray-300 mb-1">Mid-Pan Zoom:</label>
          <select id="midPanZoomFactor" value={zoomLevelOutEffective} onChange={handleMidPanZoomChange} disabled={isLoading} className="w-full p-2.5 rounded bg-gray-600 border border-gray-500 focus:ring-orange-500 focus:border-orange-500 text-gray-100">
            {midPanZoomOptions.map(zoom => (<option key={zoom} value={zoom}>{zoom}x Zoom</option>))}
          </select>
          <p className="text-xs text-gray-400 mt-1">Zoom level during pan. Cannot exceed Initial/Final Zoom.</p>
        </div>
      </div>

      {/* Image List & Canvas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Image Item List */}
        <div className="md:col-span-1 space-y-3 max-h-96 overflow-y-auto pr-2 bg-gray-800 p-3 rounded-md border border-gray-600">
          <h3 className="text-lg font-semibold text-orange-400 mb-2">Image Queue ({imageItems.length})</h3>
          {imageItems.length === 0 && <p className="text-sm text-gray-400">No images uploaded yet.</p>}
          {imageItems.map((item, index) => (
            <div 
              key={item.id}
              draggable={!isLoading}
              onDragStart={(e) => handleDragStart(e, item.id)}
              onDragOver={handleDragOver}
              onDragEnter={(e) => handleDragEnter(e, item.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, item.id)}
              onDragEnd={handleDragEnd}
              onClick={(e) => {
                if ((e.target as HTMLElement).closest('button') || isLoading) return;
                handleItemAction(item.id, 'setActive');
              }}
              className={`p-2.5 rounded-md border shadow transition-all duration-150 ease-in-out
                ${activeImageIndex === index ? 'border-orange-500 bg-gray-700' : 'border-gray-600 bg-gray-750 hover:bg-gray-700'}
                ${draggedItemId === item.id ? 'opacity-40' : ''}
                ${dragOverItemId === item.id && draggedItemId !== item.id ? 'ring-2 ring-offset-1 ring-offset-gray-800 ring-blue-400 border-blue-400' : ''}
                ${!isLoading ? 'cursor-grab' : 'cursor-default'}
              `}
            >
              <div className="flex items-center space-x-2">
                <img src={item.previewUrl} alt={`Preview ${item.file.name}`} className="w-16 h-16 object-cover rounded-sm flex-shrink-0 pointer-events-none"/> {/* pointer-events-none for img */}
                <div className="flex-grow text-xs overflow-hidden pointer-events-none"> {/* pointer-events-none for text div */}
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

        {/* Canvas for Point Selection */}
        <div className="md:col-span-2">
          {activeImageIndex !== null && imageItems[activeImageIndex] ? (
            <div>
              <p className="text-gray-300 mb-2">
                Editing points for: <span className="font-semibold text-orange-300">{imageItems[activeImageIndex].file.name}</span>. 
                {imageItems[activeImageIndex].points.length < 2 ? " Click to select P1 then P2." : " Points selected."}
              </p>
              <canvas
                ref={canvasRef}
                onClick={handleCanvasClick}
                className={`border border-gray-500 max-w-full rounded ${imageItems[activeImageIndex]?.points.length < 2 ? 'cursor-crosshair' : 'cursor-default'} bg-black`}
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
            <div className="flex items-center justify-center h-64 bg-gray-800 border border-gray-500 rounded-md">
              <p className="text-gray-400 text-center">
                {imageItems.length > 0 ? "Select an image from the queue to set points." : "Upload images to begin."}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons & Progress */}
      <div className="my-6 space-x-3">
        <button
          onClick={handleAnimate}
          disabled={isLoading || !ffmpegLoaded || imageItems.length === 0 || imageItems.some(item => item.points.length < 2)}
          className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading && ffmpegLoaded ? 'Animating...' : 'Animate All!'}
        </button>
        <button
          onClick={handleReset}
          disabled={isLoading && ffmpegLoaded}
          className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded disabled:bg-gray-500 disabled:opacity-70 transition-colors"
        >
          Reset All
        </button>
      </div>

      {isLoading && ffmpegLoaded && (
         <div className="my-4">
            {currentTaskDescription && <p className="text-sm text-orange-300 mb-1">{currentTaskDescription}</p>}
            {imageItems.length > 1 && ( 
                <>
                    <p className="text-sm text-orange-400 mb-1">Overall Progress: {(overallProgress * 100).toFixed(0)}%</p>
                    <div className="w-full bg-gray-600 rounded-full h-2.5 mb-2">
                        <div className="bg-green-500 h-2.5 rounded-full" style={{ width: `${(overallProgress * 100).toFixed(0)}%` }}></div>
                    </div>
                </>
            )}
            <p className="text-sm text-orange-400 mb-1">Current Operation Progress: {(currentOperationProgress * 100).toFixed(0)}%</p>
            <div className="w-full bg-gray-600 rounded-full h-2.5">
                <div className="bg-orange-500 h-2.5 rounded-full" style={{ width: `${(currentOperationProgress * 100).toFixed(0)}%` }}></div>
            </div>
        </div>
      )}

      {/* Video Output */}
      {videoUrl && (
        <div className="my-6">
          <h3 className="text-xl font-semibold text-orange-400 mb-3">Generated Video:</h3>
          <video src={videoUrl} controls width={OUTPUT_WIDTH / 2.5} height={OUTPUT_HEIGHT / 2.5} className="rounded border border-gray-500"/>
          <a href={videoUrl} download="animated_images_video.mp4" className="mt-3 inline-block bg-orange-500 hover:bg-orange-600 text-gray-100 py-2 px-4 rounded transition-colors">
            Download Video
          </a>
        </div>
      )}

      {/* FFmpeg Log */}
      {ffmpegLog && (
        <div className="mt-6">
          <h4 className="text-md font-semibold text-orange-400 mb-1">FFmpeg Log:</h4>
          <pre className="bg-gray-900 text-xs text-gray-300 p-3 rounded-md max-h-60 overflow-y-auto whitespace-pre-wrap break-all border border-gray-600">
            {ffmpegLog}
          </pre>
        </div>
      )}
    </div>
  );
}

export default MultiImageAnimatorPage;