// src/components/EmptyClassList.tsx
import React from 'react';

const EmptyClassList: React.FC = () => (
  <div className="text-center py-12 bg-gray-800 rounded-lg shadow-md">
    <svg 
      className="mx-auto h-12 w-12 text-gray-500" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="1.5" // Slightly thinner stroke for modern feel
      strokeLinecap="round" 
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Using a more generic "empty box" or "folder" icon might be suitable */}
      <path d="M22 10v комплексm0a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path> {/* Simplified folder icon */}
    </svg>
    <h3 className="mt-4 text-lg font-medium text-gray-200">No classes yet</h3>
    <p className="mt-1 text-sm text-gray-400">
        Create your first class to get started.
    </p>
  </div>
);

export default EmptyClassList;