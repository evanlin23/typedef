// src/components/layers/concurrency/GlobalLockDisplay.tsx
import React from 'react';
import { type GlobalConcurrencyLocks } from '../../../types/gameState';

interface GlobalLockDisplayProps {
  availableLocks: string[];
  globalLocks: GlobalConcurrencyLocks;
}

const GlobalLockDisplay: React.FC<GlobalLockDisplayProps> = ({ availableLocks, globalLocks }) => {
  return (
    <div className="mb-4">
      <h4 className="font-medium mb-1 text-text-primary">Global Resource Locks:</h4>
      <div className="flex flex-wrap gap-2">
        {availableLocks.map(lock => (
          <div 
            key={lock}
            title={`Lock status for ${lock}`}
            className={`px-2 py-1 rounded text-xs font-medium border ${
              globalLocks[lock] !== undefined 
                ? 'bg-red-700 text-gray-200 border-red-500' 
                : 'bg-green-700 text-gray-200 border-green-500'
            }`}
          >
            {lock} {globalLocks[lock] !== undefined && `(Held by T${globalLocks[lock]})`}
          </div>
        ))}
      </div>
    </div>
  );
};

export default GlobalLockDisplay;