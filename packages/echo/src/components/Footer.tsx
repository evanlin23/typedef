// src/components/Footer.tsx
import React from 'react';
// test rebuild

export const Footer: React.FC = () => {
  return (
    <footer className="p-4 text-center text-gray-400 text-sm">
      <div className="flex justify-center">
        <a 
          href="https://github.com/evanlin23/typedef" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-purple-400 hover:underline mx-2"
        >
          GitHub
        </a>
      </div>
    </footer>
  );
};