// src/components/ProgressStats.tsx
import React from 'react';
import ProgressBar from './ProgressBar'; // Using the improved ProgressBar

interface ProgressStatsProps {
  stats: {
    total: number; // Total PDFs in the current class
    toStudy: number; // PDFs with 'to-study' status
    done: number; // PDFs with 'done' status
  };
}

const ProgressStats: React.FC<ProgressStatsProps> = ({ stats }) => {
  const { total, toStudy, done } = stats;
  
  const progressPercentage = total > 0 ? Math.round((done / total) * 100) : 0;
  
  return (
    <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
      <h2 className="text-xl font-bold mb-4 text-gray-200">
        Class Progress
      </h2>
      
      {/* Using the ProgressBar component for overall progress visualization */}
      <ProgressBar 
        progress={progressPercentage}
        completedItems={done}
        totalItems={total}
        barHeight="h-2.5" // Match original style
      />
      
      <div className="grid grid-cols-2 gap-4 mt-6"> {/* Added margin top */}
        <div className="bg-gray-900 p-4 rounded-lg text-center"> {/* Centered text */}
          <h3 className="text-sm font-medium text-gray-400 mb-1">To Study</h3>
          <p className="text-3xl font-bold text-blue-400">{toStudy}</p>
        </div>
        <div className="bg-gray-900 p-4 rounded-lg text-center"> {/* Centered text */}
          <h3 className="text-sm font-medium text-gray-400 mb-1">Completed</h3>
          <p className="text-3xl font-bold text-green-400">{done}</p>
        </div>
      </div>
    </div>
  );
};

export default ProgressStats;