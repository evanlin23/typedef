// src/pages/ImageAnimatorPage.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { fetchFile } from '@ffmpeg/util';

import {
  OUTPUT_WIDTH, OUTPUT_HEIGHT, FPS, MAX_FILE_SIZE_MB, PRE_ZOOMPAN_UPSCALE_FACTOR,
  DEFAULT_RELATIVE_ZOOM_IN_FACTOR, DEFAULT_ZOOM_LEVEL_OUT_EFFECTIVE,
  INITIAL_ZOOM_OPTIONS, TOTAL_DURATION_SEC, DURATION_ZOOM_OUT
} from '../features/animation/ffmpegConstants';
import type { Point, AnimationItemData, ZoomSettings } from '../../../features/animation/ffmpegTypes';
import { useFFmpeg } from '../features/animation/useFFmpeg';
import {
  generateSingleClipFilterGraph,
  getDefaultFfmpegCommandArgs,
  getFileExtension,
} from '../features/animation/ffmpegAnimationCore';

function ImageAnimatorPage() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string>('');
  const [points, setPoints] = useState<Point[]>([]);
  const [videoUrl, setVideoUrl] = useState<string>('');
  
  const [isAnimating, setIsAnimating] = useState<boolean>(false); // For animation process
  const [isFFmpegCoreLoading, setIsFFmpegCoreLoading] = useState<boolean>(true); // For FFmpeg.js loading
  const [ffmpegLoaded, setFfmpegLoaded] = useState<boolean>(false);
  const [ffmpegLog, setFfmpegLog] = useState<string>('');
  const [progress, setProgress] = useState(0); // 0-1 for current ffmpeg task

  const [relativeZoomInFactor, setRelativeZoomInFactor] = useState<number>(DEFAULT_RELATIVE_ZOOM_IN_FACTOR);
  const [zoomLevelOutEffective, setZoomLevelOutEffective] = useState<number>(DEFAULT_ZOOM_LEVEL_OUT_EFFECTIVE);
  const [fileError, setFileError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null); // For natural dimensions
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { ffmpeg } = useFFmpeg({
    onLogMessage: (message) => {
      // Initialize log or append
      if (ffmpegLog === '' && message.startsWith('Loading ffmpeg-core.js...')) {
        setFfmpegLog(message);
      } else {
        setFfmpegLog(prev => `${prev}\n${message}`);
      }
    },
    onProgress: setProgress,
    onLoadedChange: setFfmpegLoaded,
    onCoreLoadingChange: setIsFFmpegCoreLoading,
  });

  const isLoading = isAnimating || isFFmpegCoreLoading;

  const midPanZoomOptions = Array.from(
    { length: relativeZoomInFactor },
    (_, i) => i + 1
  );

   useEffect(() => {
    if (!imagePreviewUrl || !canvasRef.current) {
        if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            ctx?.clearRect(0,0,canvasRef.current.width, canvasRef.current.height);
        }
        imageRef.current = null; // Clear image ref if no preview
        return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      imageRef.current = img; // Store image element to access naturalWidth/Height later

      const canvasMaxWidth = 600; 
      const scale = Math.min(canvasMaxWidth / img.naturalWidth, 1);
      canvas.width = img.naturalWidth * scale;
      canvas.height = img.naturalHeight * scale;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      points.forEach((point, index) => {
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
        setFileError("Could not load image preview. Please try a different file.");
        setImagePreviewUrl(''); 
        setImageFile(null);
        imageRef.current = null;
    }
    img.src = imagePreviewUrl;
  }, [imagePreviewUrl, points]);


  const handleImageUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null); 
    const file = event.target.files?.[0];

    if (file) {
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        setFileError(`File is too large. Maximum size is ${MAX_FILE_SIZE_MB}MB.`);
        if (fileInputRef.current) fileInputRef.current.value = "";
        setImageFile(null);
        setImagePreviewUrl('');
        setPoints([]);
        setVideoUrl(''); 
        setProgress(0);
        return;
      }
      setImageFile(file);
      setImagePreviewUrl(URL.createObjectURL(file));
      setPoints([]); 
      setVideoUrl('');
      setProgress(0);
    }
  }, []);

  const handleCanvasClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (points.length >= 2 || !imageRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = imageRef.current.naturalWidth / canvas.width;
    const scaleY = imageRef.current.naturalHeight / canvas.height;

    const canvasX = event.clientX - rect.left;
    const canvasY = event.clientY - rect.top;

    const originalX = Math.round(canvasX * scaleX);
    const originalY = Math.round(canvasY * scaleY);

    setPoints(prevPoints => [...prevPoints, { x: originalX, y: originalY }]);
  }, [points.length]);

  const handleAnimate = useCallback(async () => {
    if (!imageFile || points.length < 2 || !ffmpegLoaded || !imageRef.current) {
      alert('Please upload an image, select two points, ensure FFmpeg is loaded, and image dimensions are available.');
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
    
    // Preserve only the FFmpeg loading status part of the log
    const logLines = ffmpegLog.split('\n');
    const ffmpegLoadSuccessLine = logLines.find(line => line.includes("FFmpeg loaded successfully!"));
    let initialLog = ffmpegLoadSuccessLine ? ffmpegLoadSuccessLine : "FFmpeg core status unknown";
    initialLog += '\nStarting animation process...';
    setFfmpegLog(initialLog);
    
    setFfmpegLog(prev => prev + `\nUser Zoom Settings: Initial/Final=${relativeZoomInFactor}x, Mid-Pan=${zoomLevelOutEffective}x`);
    setProgress(0);

    const orig_iw = imageRef.current.naturalWidth;
    const orig_ih = imageRef.current.naturalHeight;

    if (orig_iw === 0 || orig_ih === 0) {
        alert("Image dimensions are not available or are zero. Cannot proceed.");
        setIsAnimating(false);
        return;
    }

    let extension = getFileExtension(imageFile.name);
    if (!extension) {
        if (imageFile.type.startsWith('image/')) {
            extension = imageFile.type.substring('image/'.length);
            if (extension === 'jpeg') extension = 'jpg';
        } else {
            extension = 'png'; 
            setFfmpegLog(prev => prev + `\nWarning: Could not determine image extension, defaulting to .png for input.`);
        }
    }
    const inputFileName = `input.${extension}`;
    const outputFileName = 'output.mp4';

    try {
      setFfmpegLog(prev => prev + `\nInput image dimensions: ${orig_iw}x${orig_ih}`);
      await ffmpeg.writeFile(inputFileName, await fetchFile(imageFile));

      const itemData: AnimationItemData = {
        points,
        naturalWidth: orig_iw,
        naturalHeight: orig_ih,
      };
      const zoomSettings: ZoomSettings = { relativeZoomInFactor, zoomLevelOutEffective };

      const { filterGraph, logData } = generateSingleClipFilterGraph(itemData, zoomSettings);
      
      setFfmpegLog(prev => prev + `\nFilter graph params: ${JSON.stringify(logData, null, 2)}`);
      // setFfmpegLog(prev => prev + `\nFull filter graph: ${filterGraph}`); // Can be very long

      const commandArgs = getDefaultFfmpegCommandArgs(inputFileName, filterGraph, outputFileName);
      
      setFfmpegLog(prev => prev + `\nExecuting: ffmpeg ${commandArgs.join(' ')}`);
      await ffmpeg.exec(commandArgs);

      setFfmpegLog(prev => prev + '\nProcessing complete. Reading output file...');
      const data = await ffmpeg.readFile(outputFileName);
      setVideoUrl(URL.createObjectURL(new Blob([(data as Uint8Array).buffer], { type: 'video/mp4' })));
      setFfmpegLog(prev => prev + '\nVideo generated successfully!');

    } catch (error) {
      console.error('Error during FFmpeg processing:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setFfmpegLog(prev => prev + `\nError: ${errorMessage}`);
       if (errorMessage.includes("FS error") || errorMessage.includes("Aborted") || (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' && error.message.includes("Invalid argument"))) {
          setFfmpegLog(prev => prev + `\nFFmpeg aborted or encountered an error. This might be due to an issue with the input file, filter parameters (e.g. division by zero if a duration is 0, or invalid coordinates), or an internal FFmpeg error. Check the full log for details from FFmpeg itself.`);
          if (errorMessage.includes("Invalid argument")) {
            setFfmpegLog(prev => prev + `\nTip: 'Invalid argument' often means an expression in the filter chain evaluated to something FFmpeg didn't like (e.g., NaN, infinity, or unexpected value). Double-check point coordinates, durations, and transformed point values.`);
          }
      }
      alert(`An error occurred: ${errorMessage}`);
    } finally {
      setIsAnimating(false);
      // Clean up files from FFmpeg's virtual file system
      try { await ffmpeg.deleteFile(inputFileName); } catch (e) { /* ignore */ }
      try { await ffmpeg.deleteFile(outputFileName); } catch (e) { /* ignore if it was the source of error */ }
    }
  }, [imageFile, points, ffmpegLoaded, relativeZoomInFactor, zoomLevelOutEffective, ffmpeg, ffmpegLog]);

  const handleReset = useCallback(() => {
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImageFile(null);
    setImagePreviewUrl('');
    setPoints([]);
    setVideoUrl('');
    setProgress(0);
    setFileError(null); 
    imageRef.current = null;

    setRelativeZoomInFactor(DEFAULT_RELATIVE_ZOOM_IN_FACTOR);
    setZoomLevelOutEffective(DEFAULT_ZOOM_LEVEL_OUT_EFFECTIVE);

    let resetLogMessage = "Loading ffmpeg-core.js..."; // Default if log is empty or doesn't have success
    if (ffmpegLoaded) {
        const logLines = ffmpegLog.split('\n');
        const loadSuccessLine = logLines.find(line => line.includes("FFmpeg loaded successfully!"));
        if (loadSuccessLine) {
            resetLogMessage = loadSuccessLine;
        } else { // Should not happen if ffmpegLoaded is true, but as a fallback
            resetLogMessage = "FFmpeg loaded successfully!"; 
        }
    } else if (ffmpegLog.startsWith("Loading ffmpeg-core.js...")) {
        // If still loading or failed, keep the initial loading message or relevant part
        const firstLineEnd = ffmpegLog.indexOf('\n');
        resetLogMessage = firstLineEnd > -1 ? ffmpegLog.substring(0, firstLineEnd) : ffmpegLog;
    }
    setFfmpegLog(resetLogMessage);


    if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        ctx?.clearRect(0,0,canvasRef.current.width, canvasRef.current.height);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [ffmpegLoaded, imagePreviewUrl, ffmpegLog]);

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

  return (
    <div className="max-w-4xl mx-auto p-6 bg-gray-700 shadow-lg rounded-lg text-gray-200">
      <h2 className="text-2xl font-bold text-orange-400 mb-2">Image Animator (Ken Burns Style)</h2>
      <p className="text-gray-300 mb-6">
        Upload an image, select two points (start and end), adjust zoom levels, and click "Animate!"
        to generate a {OUTPUT_WIDTH}x{OUTPUT_HEIGHT} @ {FPS}fps MP4 video. Total duration: {TOTAL_DURATION_SEC.toFixed(2)}s.
        Uses an internal upscale factor of {PRE_ZOOMPAN_UPSCALE_FACTOR}x.
      </p>

      <div className="mb-4">
        <label htmlFor="imageUploadAnimatorSingle" className="sr-only">Choose image</label>
        <input
          type="file"
          id="imageUploadAnimatorSingle"
          ref={fileInputRef}
          accept="image/*"
          onChange={handleImageUpload}
          disabled={isLoading}
          className="block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-orange-500 file:text-gray-100 hover:file:bg-orange-600 disabled:opacity-50"
        />
        {fileError && (<p className="mt-2 text-sm text-red-400" role="alert">{fileError}</p>)}
      </div>

      {isFFmpegCoreLoading && !ffmpegLoaded && (
         <div className="my-4 p-3 bg-blue-900 text-blue-100 rounded-md">
            Loading FFmpeg core, please wait...
            <div className="w-full bg-gray-600 rounded-full h-2.5 mt-2"><div className="bg-orange-500 h-2.5 rounded-full animate-pulse" style={{ width: `100%`}}></div></div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4 border border-gray-600 rounded-md">
        <div>
          <label htmlFor="initialZoomFactorSingle" className="block text-sm font-medium text-gray-300 mb-1">Initial/Final Zoom:</label>
          <select id="initialZoomFactorSingle" value={relativeZoomInFactor} onChange={handleInitialZoomChange} disabled={isLoading} className="w-full p-2.5 rounded bg-gray-600 border border-gray-500 focus:ring-orange-500 focus:border-orange-500 text-gray-100">
            {INITIAL_ZOOM_OPTIONS.map(zoom => (<option key={zoom} value={zoom}>{zoom}x Zoom</option>))}
          </select>
          <p className="text-xs text-gray-400 mt-1">Zoom level at start and end points.</p>
        </div>
        <div>
          <label htmlFor="midPanZoomFactorSingle" className="block text-sm font-medium text-gray-300 mb-1">Mid-Pan Zoom:</label>
          <select id="midPanZoomFactorSingle" value={zoomLevelOutEffective} onChange={handleMidPanZoomChange} disabled={isLoading} className="w-full p-2.5 rounded bg-gray-600 border border-gray-500 focus:ring-orange-500 focus:border-orange-500 text-gray-100">
            {midPanZoomOptions.map(zoom => (<option key={zoom} value={zoom}>{zoom}x Zoom</option>))}
          </select>
          <p className="text-xs text-gray-400 mt-1">Zoom level during pan. Cannot exceed Initial/Final Zoom.</p>
        </div>
      </div>

      {imagePreviewUrl && (
        <div className="my-4">
          <p className="text-gray-300 mb-2">Click on the image to select two points (P1 then P2).</p>
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            className={`border border-gray-500 max-w-full rounded ${points.length < 2 ? 'cursor-crosshair' : 'cursor-default'} bg-black`}
             style={{ maxHeight: '70vh', aspectRatio: imageRef.current ? `${imageRef.current.naturalWidth}/${imageRef.current.naturalHeight}` : '16/9' }}
          />
          {points.length > 0 && (
            <div className="mt-2 text-sm text-gray-300">
              <h4 className="font-semibold text-orange-400">Selected Points (Original Coords):</h4>
              {points.map((p, i) => <p key={i}>P{i+1}: ({p.x}, {p.y})</p>)}
            </div>
          )}
        </div>
      )}

      <div className="my-4 space-x-3">
        <button onClick={handleAnimate} disabled={isLoading || !ffmpegLoaded || points.length < 2 || !imageFile || !imageRef.current} className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors">
          {isAnimating ? 'Animating...' : 'Animate!'}
        </button>
        <button onClick={handleReset} disabled={isAnimating /* Allow reset even if FFmpeg core is loading, but not during animation */} className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded disabled:bg-gray-500 disabled:opacity-70 transition-colors">
          Reset
        </button>
      </div>

      {isAnimating && progress > 0 && (
         <div className="my-4">
            <p className="text-sm text-orange-400 mb-1">Processing: {(progress * 100).toFixed(0)}%</p>
            <div className="w-full bg-gray-600 rounded-full h-2.5">
                <div className="bg-orange-500 h-2.5 rounded-full" style={{ width: `${(progress * 100).toFixed(0)}%` }}></div>
            </div>
        </div>
      )}

      {videoUrl && (
        <div className="my-6">
          <h3 className="text-xl font-semibold text-orange-400 mb-3">Generated Video:</h3>
          <video src={videoUrl} controls width={OUTPUT_WIDTH / 2.5} height={OUTPUT_HEIGHT / 2.5} className="rounded border border-gray-500"/>
          <a href={videoUrl} download="animated_image.mp4" className="mt-3 inline-block bg-orange-500 hover:bg-orange-600 text-gray-100 py-2 px-4 rounded transition-colors">
            Download Video
          </a>
        </div>
      )}

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

export default ImageAnimatorPage;