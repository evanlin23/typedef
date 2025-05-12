// src/components/ErrorView.tsx
import React from 'react';
import Header from './Header';
import Footer from './Footer';

interface ErrorViewProps {
  title: string;
  message: string;
  onBackClick: () => void;
  showHeader?: boolean;
}

const ErrorView: React.FC<ErrorViewProps> = ({
  title,
  message,
  onBackClick,
  showHeader = true,
}) => {
  return (
    <div className="flex flex-col min-h-screen bg-gray-900 text-gray-200">
      {showHeader && (
        <Header
          pageTitle="Error"
          onBackClick={onBackClick}
          showBackButton={true}
        />
      )}
      <main className="flex-1 container mx-auto px-4 py-6 flex flex-col justify-center items-center">
        <h2 className="text-2xl text-red-400 mb-4">{title}</h2>
        <p className="text-gray-300 mb-4">{message}</p>
        <button
          onClick={onBackClick}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Go Back
        </button>
      </main>
      {showHeader && <Footer />}
    </div>
  );
};

export default ErrorView;
