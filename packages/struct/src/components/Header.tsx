// src/components/Header.tsx
import React from 'react';

interface HeaderProps {
  pageTitle?: string; // Renamed from className
  showBackButton?: boolean;
  onBackClick?: () => void;
}

const Header: React.FC<HeaderProps> = ({ pageTitle, showBackButton = false, onBackClick }) => (
  <header className="bg-gray-800 py-4 shadow-md sticky top-0 z-10">
    <div className="container mx-auto px-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          {showBackButton && (
            <button
              onClick={onBackClick}
              className="mr-4 text-gray-400 hover:text-gray-200 transition-colors p-1 rounded-full focus:outline-none focus:ring-2 focus:ring-green-400"
              aria-label="Go back"
            >
              <svg
                className="h-6 w-6"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
              </svg>
            </button>
          )}
          <div className="flex items-center" aria-label="Application Logo and Name">
            <svg
              className="h-8 w-8 text-green-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
            </svg>
            <h1 className="ml-2 text-2xl font-bold text-gray-200">
              struct
            </h1>
          </div>
          {pageTitle && (
            <span className="font-normal text-gray-400 ml-2 text-xl">
              / {pageTitle}
            </span>
          )}
        </div>
        {/* Placeholder for other header items */}
      </div>
    </div>
  </header>
);

export default Header;