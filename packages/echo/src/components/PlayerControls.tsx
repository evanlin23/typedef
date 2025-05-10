// src/components/PlayerControls.tsx
import React from 'react';

interface PlayerControlsProps {
  isPlaying: boolean;
  setIsPlaying: (isPlaying: boolean) => void;
  playPrevSong: () => void;
  playNextSong: () => void;
  isLoading: boolean;
}

export const PlayerControls: React.FC<PlayerControlsProps> = ({
  isPlaying,
  setIsPlaying,
  playPrevSong,
  playNextSong,
  isLoading
}) => {
  return (
    <div className="flex justify-center items-center gap-4 mb-6">
      {/* Previous button */}
      <button 
        onClick={playPrevSong}
        className="p-2 rounded-full hover:bg-gray-700 transition-colors"
        disabled={isLoading}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
          <path d="M8.445 14.832A1 1 0 0010 14v-2.798l5.445 3.63A1 1 0 0017 14V6a1 1 0 00-1.555-.832L10 8.798V6a1 1 0 00-1.555-.832l-6 4a1 1 0 000 1.664l6 4z" />
        </svg>
      </button>
      
      {/* Play/Pause button */}
      <button 
        onClick={() => setIsPlaying(!isPlaying)}
        className="p-2 rounded-full hover:bg-purple-700 transition-colors"
        disabled={isLoading}
      >
        {isPlaying ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
          </svg>
        )}
      </button>
      
      {/* Next button */}
      <button 
        onClick={playNextSong}
        className="p-2 rounded-full hover:bg-gray-700 transition-colors"
        disabled={isLoading}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
          <path d="M4.555 5.168A1 1 0 003 6v8a1 1 0 001.555.832L10 11.202V14a1 1 0 001.555.832l6-4a1 1 0 000-1.664l-6-4A1 1 0 0010 6v2.798L4.555 5.168z" />
        </svg>
      </button>
    </div>
  );
};
