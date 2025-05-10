// src/components/MusicPlayer.tsx
import React from 'react';
import type { Song } from '../types';import { ProgressBar } from './ProgressBar';
import { PlayerControls } from './PlayerControls';

interface MusicPlayerProps {
  currentSong: Song | null;
  isPlaying: boolean;
  setIsPlaying: (isPlaying: boolean) => void;
  currentTime: number;
  handleSeek: (e: React.MouseEvent<HTMLDivElement>) => void;
  progressBarRef: React.RefObject<HTMLDivElement | null>;
  playPrevSong: () => void;
  playNextSong: () => void;
  isLoading: boolean;
}

export const MusicPlayer: React.FC<MusicPlayerProps> = ({
  currentSong,
  isPlaying,
  setIsPlaying,
  currentTime,
  handleSeek,
  progressBarRef,
  playPrevSong,
  playNextSong,
  isLoading
}) => {
  if (isLoading) {
    return (
      <div className="h-64 flex flex-col items-center justify-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500 mb-4"></div>
        <p className="text-gray-400">Processing your music...</p>
      </div>
    );
  }

  if (!currentSong) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-center p-4">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
        </svg>
        <h3 className="text-lg font-semibold mb-2">No song selected</h3>
        <p className="text-gray-400">
          Upload songs using the button above or select a song from your library to start listening.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Song info */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold truncate">{currentSong.title}</h2>
        <p className="text-gray-400">{currentSong.artist}</p>
      </div>
      
      {/* Visualizer placeholder */}
      <div className="h-32 mb-6 flex items-center justify-center bg-gray-700 rounded-lg">
        <div className="w-16 h-16 rounded-full bg-purple-600 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor">
            <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
          </svg>
        </div>
      </div>
      
      {/* Progress bar */}
      <ProgressBar 
        currentTime={currentTime}
        duration={currentSong.duration}
        handleSeek={handleSeek}
        progressBarRef={progressBarRef}
      />
      
      {/* Controls */}
      <PlayerControls 
        isPlaying={isPlaying}
        setIsPlaying={setIsPlaying}
        playPrevSong={playPrevSong}
        playNextSong={playNextSong}
        isLoading={isLoading}
      />
    </>
  );
};