// src/components/Header.tsx
import React from 'react';

interface HeaderProps {
  showLibrary: boolean;
  setShowLibrary: (show: boolean) => void;
  isLoading: boolean;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const Header: React.FC<HeaderProps> = ({ 
  showLibrary, 
  setShowLibrary, 
  isLoading, 
  handleFileUpload 
}) => {
  return (
    <header className="p-4 flex justify-between items-center border-b border-gray-800">
      <h1 className="text-2xl font-bold text-purple-400">echo</h1>
      <div className="flex gap-4">
        <button 
          onClick={() => setShowLibrary(!showLibrary)}
          className="px-4 py-2 rounded-md bg-gray-800 hover:bg-gray-700 transition-colors"
        >
          {showLibrary ? "Hide Library" : "Show Library"}
        </button>
        <label className="px-4 py-2 rounded-md bg-purple-600 hover:bg-purple-700 transition-colors cursor-pointer">
          Upload Songs
          <input 
            type="file" 
            accept="audio/mp3,audio/*" 
            multiple
            onChange={handleFileUpload}
            className="hidden" 
            disabled={isLoading}
          />
        </label>
      </div>
    </header>
  );
};