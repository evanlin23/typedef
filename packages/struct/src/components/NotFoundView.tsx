// src/components/NotFoundView.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';

interface NotFoundViewProps {
    type?: string; // e.g., 'Page', 'Class', 'PDF'
    id?: string | null;
    onBackClick?: () => void; // Optional specific back handler
}

const NotFoundView: React.FC<NotFoundViewProps> = ({ type = "Page", id, onBackClick }) => {
  const navigate = useNavigate();
  const defaultBack = () => navigate('/classes'); // Default back to class list

  return (
    <div className="flex flex-col min-h-screen bg-gray-900 text-gray-200">
      <Header
        pageTitle="Not Found"
        showBackButton={true}
        onBackClick={onBackClick || defaultBack}
      />
      <main className="flex-1 container mx-auto px-4 py-6 flex flex-col justify-center items-center text-center">
        <h2 className="text-4xl font-bold text-red-400 mb-4">404 - Not Found</h2>
        <p className="text-xl text-gray-300 mb-2">
                    The {type.toLowerCase()} you requested could not be found.
        </p>
        {id && (
          <p className="text-md text-gray-400 mb-6">
                        (ID: {id})
          </p>
        )}
        <button
          onClick={onBackClick || defaultBack}
          className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        >
                    Go Back to Classes
        </button>
      </main>
      <Footer />
    </div>
  );
};

export default NotFoundView;