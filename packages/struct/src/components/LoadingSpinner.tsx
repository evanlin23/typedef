// src/components/LoadingSpinner.tsx
import React from 'react';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  className?: string; // For additional custom styling
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 'medium', className = '' }) => {
  const sizeClasses = {
    small: 'h-8 w-8 border-2',
    medium: 'h-12 w-12 border-t-2 border-b-2', // Original style
    large: 'h-16 w-16 border-t-4 border-b-4',
  };

  return (
    <div className={`flex justify-center items-center ${className}`}>
      <div 
        className={`animate-spin rounded-full border-green-400 ${sizeClasses[size]}`}
        role="status"
        aria-live="polite" // Or "assertive" if it's blocking interaction
        aria-label="Loading..."
      >
        <span className="sr-only">Loading...</span> {/* For screen readers */}
      </div>
    </div>
  );
};

export default LoadingSpinner;