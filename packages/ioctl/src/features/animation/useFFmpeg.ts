// src/features/animation/useFFmpeg.ts
import { useRef, useEffect, useCallback } from 'react';
import { FFmpeg, type ProgressEvent } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

export interface FFmpegHookProps {
  onLogMessage?: (message: string) => void;
  onProgress?: (progress: number) => void; // progress 0-1
  onLoadedChange?: (loaded: boolean) => void;
  onCoreLoadingChange?: (loading: boolean) => void; // Specifically for FFmpeg core loading
}

export function useFFmpeg(props?: FFmpegHookProps) {
  const { onLogMessage, onProgress, onLoadedChange, onCoreLoadingChange } = props || {};
  const ffmpegRef = useRef(new FFmpeg());
  
  // Internal refs to track actual loading status, independent of parent re-renders
  const internalLoadedRef = useRef(false);
  const internalLoadingRef = useRef(false); // Used to track if loading is in progress

  const loadFFmpeg = useCallback(async () => {
    // Prevent multiple load attempts if already loaded or currently loading
    if (internalLoadedRef.current || internalLoadingRef.current) {
      // If already loaded, ensure onLoadedChange(true) is called if onCoreLoadingChange was true
      if(internalLoadedRef.current) {
        onLoadedChange?.(true);
        onCoreLoadingChange?.(false);
      }
      return;
    }

    internalLoadingRef.current = true; // Set loading flag
    onCoreLoadingChange?.(true);
    onLogMessage?.('Loading ffmpeg-core.js...');

    const ffmpeg = ffmpegRef.current;

    ffmpeg.on('log', ({ message }: { type: string; message: string }) => {
      if (!message.startsWith("frame=") && !message.startsWith("size=") && !message.includes("pts_time")) {
        onLogMessage?.(message);
      }
    });

    ffmpeg.on('progress', (event: ProgressEvent) => {
      if (event.progress >= 0) {
        onProgress?.(event.progress);
      }
    });

    try {
      const coreURL = await toBlobURL('https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js', 'text/javascript');
      const wasmURL = await toBlobURL('https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.wasm', 'application/wasm');
      await ffmpeg.load({ coreURL, wasmURL });
      
      internalLoadedRef.current = true; // Set loaded flag
      onLogMessage?.('FFmpeg loaded successfully!');
      onLoadedChange?.(true);
    } catch (err) {
      console.error("FFmpeg load error:", err);
      const errorMsg = `Error loading FFmpeg: ${err instanceof Error ? err.message : String(err)}`;
      onLogMessage?.(errorMsg);
      onLoadedChange?.(false); // Explicitly set to false on error
    } finally {
      internalLoadingRef.current = false; // Clear loading flag
      // onCoreLoadingChange should reflect the final state of loading FFmpeg core.
      // If successful, it's false. If error, it's also false.
      onCoreLoadingChange?.(false); 
    }
  }, [onLogMessage, onProgress, onLoadedChange, onCoreLoadingChange]);

  useEffect(() => {
    loadFFmpeg();
  }, [loadFFmpeg]); // Load on mount and if callbacks change

  return {
    ffmpeg: ffmpegRef.current,
  };
}