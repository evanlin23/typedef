// src/components/ProgressBar.tsx
import React from 'react';

interface ProgressBarProps {
  progress: number; // Percentage value (0-100)
  completedItems: number;
  totalItems: number;
  barHeight?: string; // e.g., 'h-2', 'h-2.5'
}

const ProgressBar: React.FC<ProgressBarProps> = ({ 
  progress, 
  completedItems, 
  totalItems,
  barHeight = 'h-2', // Default height
}) => {
  // Ensure progress is within 0-100 range
  const normalizedProgress = Math.max(0, Math.min(100, progress));

  const getProgressColor = (p: number): string => {
    if (p < 30) {return 'bg-red-500';} // Low progress
    if (p < 70) {return 'bg-yellow-500';} // Medium progress
    return 'bg-green-500'; // High progress (or use theme's accent, e.g., 'bg-green-400')
  };

  return (
    <div className="mt-4">
      <div className="flex justify-between text-sm text-gray-400 mb-1">
        <span>Progress</span>
        <span>{normalizedProgress}%</span>
      </div>
      <div className={`w-full bg-gray-700 rounded-full ${barHeight} overflow-hidden`}> {/* Added overflow-hidden */}
        <div 
          className={`${getProgressColor(normalizedProgress)} ${barHeight} rounded-full transition-all duration-500 ease-out`} 
          style={{ width: `${normalizedProgress}%` }}
          role="progressbar"
          aria-valuenow={normalizedProgress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Progress: ${normalizedProgress}%`}
        ></div>
      </div>
      {totalItems > 0 && ( // Only show count if there are items
        <div className="text-xs text-gray-500 mt-1 text-right"> {/* Adjusted color and alignment */}
          {completedItems} of {totalItems} completed
        </div>
      )}
    </div>
  );
};

export default ProgressBar;