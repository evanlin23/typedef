// src/components/ClassList.tsx
import { useNavigate } from 'react-router-dom';
import type { Class } from '../utils/types';
import ClassCard from './ClassCard';
import PinIcon from './PinIcon';
import EmptyClassList from './EmptyClassList';

/**
 * Props for the ClassList component
 */
interface ClassListProps {
  /** List of classes to display */
  classes: Class[];
  /** Whether to show only pinned classes */
  showOnlyPinned: boolean;
  /** Callback when the pinned filter is toggled */
  onTogglePinnedFilter: () => void;
  /** Callback when a class deletion is requested - receives classId */
  onRequestDelete: (classId: string) => void;
  /** Callback to refresh class data */
  onDataChanged: () => Promise<void>;
}

/**
 * Component that displays a list of classes with filtering options
 */
const ClassList = ({
  classes,
  showOnlyPinned,
  onTogglePinnedFilter,
  onRequestDelete, // This is the main prop of ClassList: (classId: string) => void
  onDataChanged,
}: ClassListProps) => {
  const navigate = useNavigate();

  /**
   * Handle selection of a class card
   */
  const handleSelectClass = (classId: string) => {
    navigate(`/classes/${classId}`);
  };

  // Determine button style based on filter state
  const filterButtonClass = `
    flex items-center px-3 py-1.5 rounded-md text-sm font-medium
    transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2
    focus:ring-offset-gray-900 focus:ring-green-500
    ${showOnlyPinned
    ? 'bg-green-500 text-white hover:bg-green-600'
    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}
  `;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-200">Your Classes</h2>
        <button
          onClick={onTogglePinnedFilter}
          className={filterButtonClass.trim()}
          aria-pressed={showOnlyPinned}
        >
          <PinIcon isPinned={showOnlyPinned} className="h-4 w-4 mr-2" />
          {showOnlyPinned ? 'Show All Classes' : 'Show Pinned Only'}
        </button>
      </div>

      {classes.length === 0 ? (
        <EmptyClassList />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {classes.map((cls) => (
            <ClassCard
              key={cls.id}
              classData={cls}
              onSelect={() => cls.id && handleSelectClass(cls.id)}
              // ClassCard's onRequestDelete prop will be called,
              // which then calls ClassList's main onRequestDelete prop with the ID.
              onRequestDelete={() => {
                if (cls.id) {
                  onRequestDelete(cls.id); // Call ClassList's main onRequestDelete prop
                }
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