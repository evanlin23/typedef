import React from 'react';

interface PinIconProps {
  isPinned: boolean;
  className?: string;
}

const PinIcon: React.FC<PinIconProps> = ({ isPinned, className = "h-5 w-5" }) => {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {isPinned ? (
        <>
          <path d="M21 10l-6-6m0 0L3 16l8 8 12-12-6-6z" />
          <circle cx="8" cy="8" r="2" />
        </>
      ) : (
        <>
          <line x1="12" y1="17" x2="12" y2="22" />
          <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17z" />
        </>
      )}
    </svg>
  );
};

export default PinIcon;