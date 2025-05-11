// src/components/Footer.tsx
import React from 'react';

const Footer: React.FC = () => (
  <footer className="bg-gray-800 py-6 mt-auto border-t border-gray-700">
    <div className="container mx-auto px-4 text-center">
      <div className="flex justify-center mt-2">
        <a 
          href="https://github.com/evanlin23/typedef"
          target="_blank" 
          rel="noopener noreferrer"
          className="text-purple-400 hover:text-purple-300 hover:underline mx-2 transition-colors duration-150 text-sm"
        >
            GitHub
        </a>
      </div>
    </div>
  </footer>
);

export default Footer;