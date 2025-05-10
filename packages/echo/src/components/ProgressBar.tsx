// src/components/ProgressBar.tsx
import React from 'react';
import { formatTime } from '../utils/formatTime';

interface ProgressBarProps {
  currentTime: number;
  duration: number;
  handleSeek: (e: React.MouseEvent<HTMLDivElement>) => void;
  progressBarRef: React.RefObject<HTMLDivElement | null>;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ 
  currentTime, 
  duration, 
  handleSeek, 
  progressBarRef 
}) => {
  return (
    <div className="mb-4">
      <div 
        ref={progressBarRef}
        className="h-2 bg-gray-700 rounded-full cursor-pointer"
        onClick={handleSeek}
      >
        <div 
          className="h-full bg-purple-600 rounded-full"
          style={{ width: `${(currentTime / duration) * 100}%` }}
        ></div>
      </div>
      <div className="flex justify-between mt-1 text-xs text-gray-400">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
};