// src/components/EmptyClassList.tsx
import React from 'react';

const EmptyClassList: React.FC = () => (
  <div className="text-center py-12 bg-gray-800 rounded-lg shadow-md">
    <h3 className="mt-4 text-lg font-medium text-gray-200">No classes yet</h3>
    <p className="mt-1 text-sm text-gray-400">
        Create your first class to get started.
    </p>
  </div>
);

export default EmptyClassList;