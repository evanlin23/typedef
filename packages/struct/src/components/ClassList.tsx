// src/components/ClassList.tsx
import React from 'react';
import type { Class } from '../utils/types';
import ClassCard from './ClassCard';
import PinIcon from './PinIcon';
import EmptyClassList from './EmptyClassList';

interface ClassListProps {
  classes: Class[];
  showOnlyPinned: boolean;
  onTogglePinnedFilter: () => void;
  onSelectClass: (classId: string) => void; // Changed: number to string
  onRequestDelete: (classId: string) => void; // Changed: number to string
  onDataChanged: () => Promise<void>;
}

const ClassList: React.FC<ClassListProps> = ({
  classes,
  showOnlyPinned,
  onTogglePinnedFilter,
  onSelectClass,
  onRequestDelete,
  onDataChanged,
}) => {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-200">Your Classes</h2>
        <button
          onClick={onTogglePinnedFilter}
          className={`flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-green-500 ${
            showOnlyPinned
              ? 'bg-green-500 text-white hover:bg-green-600'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
          aria-pressed={showOnlyPinned}
        >
          <PinIcon isPinned={showOnlyPinned} className="h-4 w-4 mr-2" />
          {showOnlyPinned ? 'Show All Classes' : 'Show Pinned Only'}
        </button>
      </div>
      {classes.length === 0 ? <EmptyClassList /> : 
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {classes.map((cls) => (
            <ClassCard
              key={cls.id} // cls.id is now string (UUID)
              classData={cls}
              onSelect={() => { if (cls.id) { onSelectClass(cls.id); } }} // cls.id is string
              onRequestDelete={(e) => {
                e.stopPropagation();
                if (cls.id) { onRequestDelete(cls.id); } // cls.id is string
              }}
              onDataChanged={onDataChanged}
            />
          ))}
        </div>
      }
    </div>
  );
};

export default ClassList;