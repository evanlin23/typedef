import React from 'react';

const EmptyClassList: React.FC = () => {
  return (
    <div className="text-center py-12 bg-gray-800 rounded-lg">
      <svg 
        className="mx-auto h-12 w-12 text-gray-400" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      >
        <path d="M12 20v-6M6 20V10M18 20V4"></path>
      </svg>
      <h3 className="mt-2 text-lg font-medium text-gray-200">No classes yet</h3>
      <p className="mt-1 text-gray-400">
        Create your first class to get started
      </p>
    </div>
  );
};

export default EmptyClassList;