// src/components/ClassList.tsx
import React from 'react';
import type { Class } from '../utils/types';
import ClassCard from './ClassCard';
import PinIcon from './PinIcon'; // Assuming PinIcon is also used for the filter button
import EmptyClassList from './EmptyClassList';
// LoadingSpinner is handled by parent (ClassManagement)

interface ClassListProps {
  classes: Class[];
  showOnlyPinned: boolean;
  onTogglePinnedFilter: () => void;
  onSelectClass: (classId: number) => void;
  onRequestDelete: (classId: number) => void; // To ask parent to confirm deletion
  onDataChanged: () => Promise<void>; // To allow ClassCard to trigger list refresh
}

const ClassList: React.FC<ClassListProps> = ({
  classes,
  showOnlyPinned,
  onTogglePinnedFilter,
  onSelectClass,
  onRequestDelete,
  onDataChanged,
}) => {
  if (classes.length === 0) {
    return <EmptyClassList />;
  }

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
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"> {/* Increased gap slightly */}
        {classes.map((cls) => (
          <ClassCard
            key={cls.id} // Assuming cls.id is defined and unique
            classData={cls}
            onSelect={() => { if(cls.id) {onSelectClass(cls.id);}}}
            onRequestDelete={(e) => { // Pass MouseEvent for stopPropagation if needed
              e.stopPropagation(); // Prevent card selection when clicking delete icon
              if (cls.id) {onRequestDelete(cls.id);}
            }}
            onDataChanged={onDataChanged}
          />
        ))}
      </div>
    </div>
  );
};

export default ClassList;