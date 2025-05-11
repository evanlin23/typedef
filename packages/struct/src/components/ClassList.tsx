import React from 'react';
import type { Class } from '../utils/types';
import ClassCard from './ClassCard';
import PinIcon from './PinIcon';
import EmptyClassList from './EmptyClassList';
import LoadingSpinner from './LoadingSpinner';

interface ClassListProps {
  classes: Class[];
  isLoading: boolean;
  showOnlyPinned: boolean;
  onTogglePinnedFilter: () => void;
  onSelectClass: (classId: number) => void;
  onRequestDelete: (classId: number) => void;
  onDataChanged: () => Promise<void>;
}

const ClassList: React.FC<ClassListProps> = ({
  classes,
  isLoading,
  showOnlyPinned,
  onTogglePinnedFilter,
  onSelectClass,
  onRequestDelete,
  onDataChanged
}) => {
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-200">Your Classes</h2>
        <button
          onClick={onTogglePinnedFilter}
          className={`flex items-center px-3 py-1 rounded ${
            showOnlyPinned ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300'
          }`}
        >
          <PinIcon isPinned={showOnlyPinned} className="h-4 w-4 mr-2" />
          {showOnlyPinned ? 'Show All' : 'Show Pinned'}
        </button>
      </div>
      
      {isLoading ? (
        <LoadingSpinner />
      ) : classes.length === 0 ? (
        <EmptyClassList />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {classes.map((cls) => (
            <ClassCard
              key={cls.id}
              classData={cls}
              onSelect={() => onSelectClass(cls.id!)}
              onRequestDelete={(e) => {
                e.stopPropagation();
                onRequestDelete(cls.id!);
              }}
              onDataChanged={onDataChanged}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ClassList;