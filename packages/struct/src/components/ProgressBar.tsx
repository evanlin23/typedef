// src/components/ProgressBar.tsx

/**
 * Props for the ProgressBar component
 */
interface ProgressBarProps {
  /** Percentage value (0-100) */
  progress: number;
  /** Number of completed items */
  completedItems: number;
  /** Total number of items */
  totalItems: number;
  /** CSS height class for the progress bar (e.g., 'h-2', 'h-2.5') */
  barHeight?: string;
}

/**
 * Get the appropriate color class based on progress percentage
 * @param progress - The progress percentage (0-100)
 * @returns CSS class for the progress bar color
 */
const getProgressColor = (progress: number): string => {
  if (progress < 30) return 'bg-red-500';    // Low progress
  if (progress < 70) return 'bg-yellow-500'; // Medium progress
  return 'bg-green-500';                     // High progress
};

/**
 * A progress bar component that visualizes completion status
 */
const ProgressBar = ({ 
  progress, 
  completedItems, 
  totalItems,
  barHeight = 'h-2'
}: ProgressBarProps) => {
  // Ensure progress is within 0-100 range
  const normalizedProgress = Math.max(0, Math.min(100, progress));
  
  // Get the color based on progress level
  const progressColor = getProgressColor(normalizedProgress);
  
  // Classes for the progress bar container
  const containerClasses = `w-full bg-gray-700 rounded-full ${barHeight} overflow-hidden`;
  
  // Classes for the progress indicator
  const indicatorClasses = `${progressColor} ${barHeight} rounded-full transition-all duration-500 ease-out`;

  return (
    <div className="mt-4">
      {/* Progress header with percentage */}
      <div className="flex justify-between text-sm text-gray-400 mb-1">
        <span>Progress</span>
        <span>{normalizedProgress}%</span>
      </div>
      
      {/* Progress bar */}
      <div className={containerClasses}>
        <div 
          className={indicatorClasses}
          style={{ width: `${normalizedProgress}%` }}
          role="progressbar"
          aria-valuenow={normalizedProgress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Progress: ${normalizedProgress}%`}
        />
      </div>
      
      {/* Item count (only shown if there are items) */}
      {totalItems > 0 && (
        <div className="text-xs text-gray-500 mt-1 text-right">
          {completedItems} of {totalItems} completed
        </div>
      )}
    </div>
  );
};

export default ProgressBar;