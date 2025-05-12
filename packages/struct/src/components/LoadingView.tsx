// src/components/LoadingView.tsx
import React from 'react';
import Header from './Header';
import Footer from './Footer';
import LoadingSpinner from './LoadingSpinner';

interface LoadingViewProps {
  message?: string;
  pageTitle?: string;
  onBackClick?: () => void;
  showBackButton?: boolean;
  showHeader?: boolean;
}

const LoadingView: React.FC<LoadingViewProps> = ({
  message = 'Loading...',
  pageTitle = 'Loading...',
  onBackClick,
  showBackButton = false,
  showHeader = true,
}) => {
  return (
    <div className="flex flex-col min-h-screen bg-gray-900 text-gray-200">
      {showHeader && (
        <Header
          pageTitle={pageTitle}
          onBackClick={onBackClick}
          showBackButton={showBackButton}
        />
      )}
      <main className="flex-1 container mx-auto px-4 py-6 flex flex-col justify-center items-center">
        <LoadingSpinner size="large" />
        <p className="text-gray-400 mt-4">{message}</p>
      </main>
      {showHeader && <Footer />}
    </div>
  );
};

export default LoadingView;
