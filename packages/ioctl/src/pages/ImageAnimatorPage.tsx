// src/pages/ImageAnimatorPage.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { FFmpeg, type ProgressEvent } from '@ffmpeg/ffmpeg'; // FFmpeg type
import { fetchFile, toBlobURL } from '@ffmpeg/util';

// --- Configuration Constants ---
const OUTPUT_WIDTH = 720; // For 9:16 aspect ratio
const OUTPUT_HEIGHT = 1280;
const FPS = 60;
const MAX_FILE_SIZE_MB = 20;

const PRE_ZOOMPAN_UPSCALE_FACTOR = 8;

// Default zoom levels (user-configurable)
const DEFAULT_RELATIVE_ZOOM_IN_FACTOR = 6;
const DEFAULT_ZOOM_LEVEL_OUT_EFFECTIVE = 2;

const INITIAL_ZOOM_OPTIONS = [2, 3, 4, 5, 6, 7, 8, 9, 10];

// Durations in seconds for each animation phase
const DURATION_HOLD_START = 0.5;
const DURATION_ZOOM_OUT = 1.5;
const DURATION_PAN = 2.0;
const DURATION_ZOOM_IN = 1.5;
const DURATION_HOLD_END = 0.5;

const TOTAL_DURATION_SEC =
  DURATION_HOLD_START +
  DURATION_ZOOM_OUT +
  DURATION_PAN +
  DURATION_ZOOM_IN +
  DURATION_HOLD_END;

// --- TypeScript Interfaces ---
interface Point {
  x: number;
  y: number;
}

function ImageAnimatorPage() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string>('');
  const [points, setPoints] = useState<Point[]>([]);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [ffmpegLog, setFfmpegLog] = useState<string>('');
  const [ffmpegLoaded, setFfmpegLoaded] = useState<boolean>(false);
  const [progress, setProgress] = useState(0); // progress is expected to be 0 to 1

  // User-configurable zoom factors
  const [relativeZoomInFactor, setRelativeZoomInFactor] = useState<number>(DEFAULT_RELATIVE_ZOOM_IN_FACTOR);
  const [zoomLevelOutEffective, setZoomLevelOutEffective] = useState<number>(DEFAULT_ZOOM_LEVEL_OUT_EFFECTIVE);

  // New state for file upload error
  const [fileError, setFileError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const ffmpegRef = useRef(new FFmpeg());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generate options for Mid-Pan Zoom based on Initial/Final Zoom
  const midPanZoomOptions = Array.from(
    { length: relativeZoomInFactor },
    (_, i) => i + 1 // Creates [1, 2, ..., relativeZoomInFactor]
  );

  // Load FFmpeg
  useEffect(() => {
    const loadFFmpeg = async () => {
      setIsLoading(true);
      setFfmpegLog('Loading ffmpeg-core.js...');
      const ffmpeg = ffmpegRef.current;
      ffmpeg.on('log', ({ message }: { type: string; message: string }) => {
        if (!message.startsWith("frame=") && !message.startsWith("size=") && !message.includes("pts_time")) {
          setFfmpegLog(prev => `${prev}\n${message}`);
        }
      });
      ffmpeg.on('progress', (event: ProgressEvent) => {
        setProgress(event.progress);
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
        alert("Failed to load FFmpeg. Check console for details. You might need to enable SharedArrayBuffer or use a different core version if issues persist with COOP/COEP headers.");
      } finally {
        setIsLoading(false);
      }
    };
    loadFFmpeg();
  }, []);


  // Draw image and points on canvas
   useEffect(() => {
    if (!imagePreviewUrl || !canvasRef.current) {
        // If there's no preview URL (e.g., after an invalid file or reset), clear canvas
        if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            ctx?.clearRect(0,0,canvasRef.current.width, canvasRef.current.height);
        }
        return;
    }


    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      imageRef.current = img;

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
        // Handle case where image loading fails for the preview
        setFileError("Could not load image preview. Please try a different file.");
        setImagePreviewUrl(''); // Clear preview URL to prevent retries
        setImageFile(null);
    }
    img.src = imagePreviewUrl;
  }, [imagePreviewUrl, points]); // Added setFileError, setImagePreviewUrl, setImageFile to dependencies if they are stable, otherwise wrap img.onerror content in useCallback or ensure it doesn't cause re-renders excessively. Since they are setters, they are stable.


  const handleImageUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null); // Clear previous error on new selection attempt
    const file = event.target.files?.[0];

    if (file) {
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        setFileError(`File is too large. Maximum size is ${MAX_FILE_SIZE_MB}MB.`);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        // Clear image-related states if a bad file was selected to avoid showing stale preview
        setImageFile(null);
        setImagePreviewUrl('');
        setPoints([]);
        setVideoUrl(''); // Also clear any existing video
        setProgress(0);
        return;
      }

      // If file is valid
      setImageFile(file);
      setImagePreviewUrl(URL.createObjectURL(file));
      setPoints([]); // Reset points for new image
      setVideoUrl('');
      setProgress(0);
    } else {
      // User cancelled file dialog or no file selected
      // If no new file is chosen, and an old one exists, do nothing to fileError
      // If no file was chosen AND no file is currently set (imageFile is null),
      // we can clear any potential "stuck" error. But clearing at the top is generally sufficient.
    }
  }, []); // fileInputRef is stable. Setters are stable. MAX_FILE_SIZE_MB is const.

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
    // Basic validation, though dropdowns limit choices
    if (relativeZoomInFactor < 2 || zoomLevelOutEffective < 1 || zoomLevelOutEffective > relativeZoomInFactor) {
      alert('Invalid zoom factor selection. Please check your choices.');
      return;
    }
    if (relativeZoomInFactor <= zoomLevelOutEffective && DURATION_ZOOM_OUT > 0) {
        setFfmpegLog(prev => prev + `\nWarning: Initial/Final zoom (${relativeZoomInFactor}x) is not greater than Mid-Pan zoom (${zoomLevelOutEffective}x). This will result in zooming *in* or staying same during the 'zoom-out' phase.`);
    }

    setIsLoading(true);
    setVideoUrl('');
    setFfmpegLog(prev => prev.split('\n').slice(0,2).join('\n') + '\nStarting animation process...');
    setFfmpegLog(prev => prev + `\nUser Zoom Settings: Initial/Final=${relativeZoomInFactor}x, Mid-Pan=${zoomLevelOutEffective}x`);
    setProgress(0);

    const ffmpeg = ffmpegRef.current;
    const orig_iw = imageRef.current.naturalWidth;
    const orig_ih = imageRef.current.naturalHeight;

    if (orig_iw === 0 || orig_ih === 0) {
        alert("Image dimensions are not available or are zero. Cannot proceed.");
        setIsLoading(false);
        return;
    }

    const getFileExtension = (filename: string): string => {
      const lastDot = filename.lastIndexOf(".");
      if (lastDot === -1 || lastDot === 0 || lastDot === filename.length - 1) { return ''; }
      return filename.slice(lastDot + 1).toLowerCase();
    };

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

      const p1_orig = points[0];
      const p2_orig = points[1];
      const totalFrames = Math.round(TOTAL_DURATION_SEC * FPS);

      const INTERMEDIATE_CANVAS_WIDTH = OUTPUT_WIDTH * PRE_ZOOMPAN_UPSCALE_FACTOR;
      const INTERMEDIATE_CANVAS_HEIGHT = OUTPUT_HEIGHT * PRE_ZOOMPAN_UPSCALE_FACTOR;
      setFfmpegLog(prev => prev + `\nUsing pre-zoompan upscale factor: ${PRE_ZOOMPAN_UPSCALE_FACTOR}`);
      setFfmpegLog(prev => prev + `\nIntermediate canvas size for zoompan input: ${INTERMEDIATE_CANVAS_WIDTH}x${INTERMEDIATE_CANVAS_HEIGHT}`);

      const intermediate_scale_factor = Math.min(INTERMEDIATE_CANVAS_WIDTH / orig_iw, INTERMEDIATE_CANVAS_HEIGHT / orig_ih);
      const intermediate_scaled_iw = orig_iw * intermediate_scale_factor;
      const intermediate_scaled_ih = orig_ih * intermediate_scale_factor;
      const intermediate_pad_x = (INTERMEDIATE_CANVAS_WIDTH - intermediate_scaled_iw) / 2;
      const intermediate_pad_y = (INTERMEDIATE_CANVAS_HEIGHT - intermediate_scaled_ih) / 2;

      const p1_intermediate_transformed = {
        x: p1_orig.x * intermediate_scale_factor + intermediate_pad_x,
        y: p1_orig.y * intermediate_scale_factor + intermediate_pad_y,
      };
      const p2_intermediate_transformed = {
        x: p2_orig.x * intermediate_scale_factor + intermediate_pad_x,
        y: p2_orig.y * intermediate_scale_factor + intermediate_pad_y,
      };

      const p1_interm_t_x_rounded = parseFloat(p1_intermediate_transformed.x.toFixed(4));
      const p1_interm_t_y_rounded = parseFloat(p1_intermediate_transformed.y.toFixed(4));
      const p2_interm_t_x_rounded = parseFloat(p2_intermediate_transformed.x.toFixed(4));
      const p2_interm_t_y_rounded = parseFloat(p2_intermediate_transformed.y.toFixed(4));

      setFfmpegLog(prev => prev + `\nImage will be scaled by ${intermediate_scale_factor.toFixed(4)} to ${intermediate_scaled_iw.toFixed(1)}x${intermediate_scaled_ih.toFixed(1)} on intermediate canvas.`);
      setFfmpegLog(prev => prev + `\nPadding on intermediate canvas (x,y): ${intermediate_pad_x.toFixed(2)}, ${intermediate_pad_y.toFixed(2)}`);
      setFfmpegLog(prev => prev + `\nP1 original: (${p1_orig.x}, ${p1_orig.y}), intermediate transformed rounded: (${p1_interm_t_x_rounded}, ${p1_interm_t_y_rounded})`);
      setFfmpegLog(prev => prev + `\nP2 original: (${p2_orig.x}, ${p2_orig.y}), intermediate transformed rounded: (${p2_interm_t_x_rounded}, ${p2_interm_t_y_rounded})`);

      const f_hold_start_end = Math.round(DURATION_HOLD_START * FPS);
      const f_zoom_out_end = f_hold_start_end + Math.round(DURATION_ZOOM_OUT * FPS);
      const f_pan_end = f_zoom_out_end + Math.round(DURATION_PAN * FPS);
      const f_zoom_in_end = f_pan_end + Math.round(DURATION_ZOOM_IN * FPS);
      
      const currentRelativeZoomIn = parseFloat(relativeZoomInFactor.toFixed(4));
      const currentZoomOutEffective = parseFloat(zoomLevelOutEffective.toFixed(4));

      const zoomExpr =
        `if(lt(on,${f_hold_start_end}),${currentRelativeZoomIn},` +
        `if(lt(on,${f_zoom_out_end}),${currentRelativeZoomIn} - (${currentRelativeZoomIn}-${currentZoomOutEffective})*(on-${f_hold_start_end})/(${DURATION_ZOOM_OUT*FPS}),` +
        `if(lt(on,${f_pan_end}),${currentZoomOutEffective},` +
        `if(lt(on,${f_zoom_in_end}),${currentZoomOutEffective} + (${currentRelativeZoomIn}-${currentZoomOutEffective})*(on-${f_pan_end})/(${DURATION_ZOOM_IN*FPS}),` +
        `${currentRelativeZoomIn}))))`;

      const targetXTimelineExpr_intermediate =
        `if(lt(on,${f_zoom_out_end}),${p1_interm_t_x_rounded},` +
        `if(lt(on,${f_pan_end}),${p1_interm_t_x_rounded} + (${p2_interm_t_x_rounded}-${p1_interm_t_x_rounded})*(on-${f_zoom_out_end})/(${DURATION_PAN*FPS}),` +
        `${p2_interm_t_x_rounded}))`;

      const targetYTimelineExpr_intermediate =
        `if(lt(on,${f_zoom_out_end}),${p1_interm_t_y_rounded},` +
        `if(lt(on,${f_pan_end}),${p1_interm_t_y_rounded} + (${p2_interm_t_y_rounded}-${p1_interm_t_y_rounded})*(on-${f_zoom_out_end})/(${DURATION_PAN*FPS}),` +
        `${p2_interm_t_y_rounded}))`;

      const zoompanXExpr = `round((${targetXTimelineExpr_intermediate}) - ((${INTERMEDIATE_CANVAS_WIDTH})/(${zoomExpr}))/2)`;
      const zoompanYExpr = `round((${targetYTimelineExpr_intermediate}) - ((${INTERMEDIATE_CANVAS_HEIGHT})/(${zoomExpr}))/2)`;

      const filterGraph =
        `scale=w=${INTERMEDIATE_CANVAS_WIDTH}:h=${INTERMEDIATE_CANVAS_HEIGHT}:force_original_aspect_ratio=decrease,` +
        `pad=width=${INTERMEDIATE_CANVAS_WIDTH}:height=${INTERMEDIATE_CANVAS_HEIGHT}:x='(ow-iw)/2':y='(oh-ih)/2':color=black,` +
        `zoompan=z='${zoomExpr}':x='${zoompanXExpr}':y='${zoompanYExpr}':d=${totalFrames}:s=${OUTPUT_WIDTH}x${OUTPUT_HEIGHT}:fps=${FPS},` +
        `format=yuv420p`;

      const command = [
        '-i', inputFileName,
        '-vf', filterGraph,
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '28',
        '-t', TOTAL_DURATION_SEC.toString(),
        outputFileName
      ];

      setFfmpegLog(prev => prev + `\nFull filter graph: ${filterGraph}`);
      setFfmpegLog(prev => prev + `\nExecuting: ffmpeg ${command.join(' ')}`);
      await ffmpeg.exec(command);

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
            setFfmpegLog(prev => prev + `\nTip: 'Invalid argument' often means an expression in the filter chain evaluated to something FFmpeg didn't like (e.g., NaN, infinity, or unexpected value). Double-check point coordinates, durations, and transformed point values. The use of round() might also interact strangely if intermediate values are non-numeric due to an earlier issue.`);
          }
      }
      alert(`An error occurred: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  }, [imageFile, points, ffmpegLoaded, relativeZoomInFactor, zoomLevelOutEffective]);

  const handleReset = useCallback(() => {
    setImageFile(null);
    setImagePreviewUrl('');
    setPoints([]);
    setVideoUrl('');
    setProgress(0);
    setFileError(null); // Clear file error on reset
    imageRef.current = null;

    setRelativeZoomInFactor(DEFAULT_RELATIVE_ZOOM_IN_FACTOR);
    setZoomLevelOutEffective(DEFAULT_ZOOM_LEVEL_OUT_EFFECTIVE);

    let resetLogMessage = "Loading ffmpeg-core.js...";
    const successMsg = "FFmpeg loaded successfully!";
    const loadingMsg = "Loading ffmpeg-core.js...";
    const currentLog = ffmpegLog;

    if (ffmpegLoaded) {
        if (currentLog.includes(loadingMsg) && currentLog.includes(successMsg)) {
            const loadingIndex = currentLog.indexOf(loadingMsg);
            const successIndex = currentLog.indexOf(successMsg, loadingIndex);
            if (loadingIndex !== -1 && successIndex !== -1 && successIndex > loadingIndex) {
                resetLogMessage = currentLog.substring(loadingIndex, successIndex + successMsg.length);
            } else {
                 resetLogMessage = `${loadingMsg}\n${successMsg}`;
            }
        } else {
             resetLogMessage = successMsg;
        }
    } else {
        if (currentLog.startsWith(loadingMsg)) {
            const firstLineEnd = currentLog.indexOf('\n');
            resetLogMessage = firstLineEnd > -1 ? currentLog.substring(0, firstLineEnd) : currentLog;
            if (!resetLogMessage.trim().endsWith("...")) {
                resetLogMessage = loadingMsg;
            }
        } else {
            resetLogMessage = loadingMsg;
        }
    }
    setFfmpegLog(resetLogMessage);

    if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        ctx?.clearRect(0,0,canvasRef.current.width, canvasRef.current.height);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [ffmpegLoaded, ffmpegLog]);

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

  // --- JSX ---
  return (
    <div className="max-w-4xl mx-auto p-6 bg-gray-700 shadow-lg rounded-lg text-gray-200">
      <h2 className="text-2xl font-bold text-orange-400 mb-2">Image Animator (Ken Burns Style)</h2>
      <p className="text-gray-300 mb-6">
        Upload an image, select two points (start and end), adjust zoom levels, and click "Animate!"
        to generate a 9:16 MP4 video. The image will be fit within the frame,
        then zoom based on your settings, pan between points, and zoom again.
        Uses an internal upscale factor of {PRE_ZOOMPAN_UPSCALE_FACTOR}x before zoom/pan to potentially reduce jitter.
      </p>

      <div className="mb-4">
        <label htmlFor="imageUploadAnimator" className="sr-only">Choose image</label>
        <input
          type="file"
          id="imageUploadAnimator"
          ref={fileInputRef}
          accept="image/*"
          onChange={handleImageUpload}
          disabled={isLoading}
          className="block w-full text-sm text-gray-300
                     file:mr-4 file:py-2 file:px-4
                     file:rounded-md file:border-0
                     file:text-sm file:font-semibold
                     file:bg-orange-500 file:text-gray-100
                     hover:file:bg-orange-600 disabled:opacity-50"
        />
        {fileError && (
          <p className="mt-2 text-sm text-red-400" role="alert">
            {fileError}
          </p>
        )}
      </div>

      {!ffmpegLoaded && isLoading && (
         <div className="my-4 p-3 bg-blue-900 text-blue-100 rounded-md">
            Loading FFmpeg core, please wait... (this might take a moment on first visit)
            <div className="w-full bg-gray-600 rounded-full h-2.5 mt-2">
                <div className="bg-orange-500 h-2.5 rounded-full animate-pulse" style={{ width: `100%`}}></div>
            </div>
        </div>
      )}

      {/* Zoom Configuration Dropdowns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4 border border-gray-600 rounded-md">
        <div>
          <label htmlFor="initialZoomFactor" className="block text-sm font-medium text-gray-300 mb-1">
            Initial/Final Zoom:
          </label>
          <select
            id="initialZoomFactor"
            value={relativeZoomInFactor}
            onChange={handleInitialZoomChange}
            disabled={isLoading}
            className="w-full p-2.5 rounded bg-gray-600 border border-gray-500 focus:ring-orange-500 focus:border-orange-500 text-gray-100"
          >
            {INITIAL_ZOOM_OPTIONS.map(zoom => (
              <option key={zoom} value={zoom}>{zoom}x Zoom</option>
            ))}
          </select>
          <p className="text-xs text-gray-400 mt-1">Zoom level at start and end points.</p>
        </div>
        <div>
          <label htmlFor="midPanZoomFactor" className="block text-sm font-medium text-gray-300 mb-1">
            Mid-Pan Zoom:
          </label>
          <select
            id="midPanZoomFactor"
            value={zoomLevelOutEffective}
            onChange={handleMidPanZoomChange}
            disabled={isLoading}
            className="w-full p-2.5 rounded bg-gray-600 border border-gray-500 focus:ring-orange-500 focus:border-orange-500 text-gray-100"
          >
            {midPanZoomOptions.map(zoom => (
              <option key={zoom} value={zoom}>{zoom}x Zoom</option>
            ))}
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
            className={`border border-gray-500 max-w-full rounded ${points.length < 2 ? 'cursor-crosshair' : 'cursor-default'}`}
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
        <button
          onClick={handleAnimate}
          disabled={isLoading || !ffmpegLoaded || points.length < 2 || !imageFile || !imageRef.current}
          className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded
                     disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading && ffmpegLoaded ? 'Animating...' : 'Animate!'}
        </button>
        <button
          onClick={handleReset}
          disabled={isLoading && ffmpegLoaded}
          className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded
                     disabled:bg-gray-500 disabled:opacity-70 transition-colors"
        >
          Reset
        </button>
      </div>

      {isLoading && ffmpegLoaded && progress > 0 && (
         <div className="my-4">
            <p className="text-sm text-orange-400 mb-1">Processing: {(progress * 100 / 150).toFixed(0)}%</p> {/* Note: progress is 0-1, so *100 for percent. Division by 150 seems custom */}
            <div className="w-full bg-gray-600 rounded-full h-2.5">
                <div className="bg-orange-500 h-2.5 rounded-full" style={{ width: `${(progress * 100 / 150).toFixed(0)}%` }}></div> {/* Adjusted width calc if progress is 0-1 */}
            </div>
        </div>
      )}


      {videoUrl && (
        <div className="my-6">
          <h3 className="text-xl font-semibold text-orange-400 mb-3">Generated Video:</h3>
          <video
            src={videoUrl}
            controls
            width={OUTPUT_WIDTH / 2.5}
            height={OUTPUT_HEIGHT / 2.5}
            className="rounded border border-gray-500"
          />
          <a
            href={videoUrl}
            download="animated_image.mp4"
            className="mt-3 inline-block bg-orange-500 hover:bg-orange-600 text-gray-100 py-2 px-4 rounded transition-colors"
          >
            Download Video
          </a>
        </div>
      )}

      {ffmpegLog && (
        <div className="mt-6">
          <h4 className="text-md font-semibold text-orange-400 mb-1">FFmpeg Log:</h4>
          <pre
           className="bg-gray-800 text-xs text-gray-300 p-3 rounded-md max-h-48 overflow-y-auto
                      whitespace-pre-wrap break-all border border-gray-600"
          >
            {ffmpegLog}
          </pre>
        </div>
      )}
    </div>
  );
}

export default ImageAnimatorPage;