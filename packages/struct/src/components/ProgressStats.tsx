import React from 'react';

interface ProgressStatsProps {
  stats: {
    total: number;
    toStudy: number;
    done: number;
  };
}

const ProgressStats: React.FC<ProgressStatsProps> = ({ stats }) => {
  const { total, toStudy, done } = stats;
  
  // Calculate progress percentage
  const progressPercentage = total > 0 ? Math.round((done / total) * 100) : 0;
  
  return (
    <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
      <h2 className="text-xl font-bold mb-4 text-gray-200">
        Study Progress
      </h2>
      
      <div className="mb-4">
        <div className="flex justify-between mb-1">
          <span className="text-sm font-medium text-gray-400">
            {progressPercentage}% Complete
          </span>
          <span className="text-sm font-medium text-gray-400">
            {done}/{total}
          </span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2.5">
          <div 
            className="bg-green-400 h-2.5 rounded-full" 
            style={{ width: `${progressPercentage}%` }}
          ></div>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-900 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-gray-400">To Study</h3>
          <p className="text-2xl font-bold text-blue-400">{toStudy}</p>
        </div>
        <div className="bg-gray-900 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-gray-400">Completed</h3>
          <p className="text-2xl font-bold text-green-400">{done}</p>
        </div>
      </div>
    </div>
  );
};

export default ProgressStats;