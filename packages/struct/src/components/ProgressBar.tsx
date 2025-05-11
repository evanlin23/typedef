import React from 'react';

interface ProgressBarProps {
  progress: number;
  completedItems: number;
  totalItems: number;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ progress, completedItems, totalItems }) => {
  // Function to determine the color of the progress bar based on completion percentage
  const getProgressColor = (progress: number) => {
    if (progress < 30) return 'bg-red-500';
    if (progress < 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className="mt-4">
      <div className="flex justify-between text-sm text-gray-400 mb-1">
        <span>Progress</span>
        <span>{progress}%</span>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-2">
        <div 
          className={`${getProgressColor(progress)} h-2 rounded-full`} 
          style={{ width: `${progress}%` }}
        ></div>
      </div>
      <div className="text-xs text-gray-400 mt-1">
        {completedItems} of {totalItems} PDFs completed
      </div>
    </div>
  );
};

export default ProgressBar;