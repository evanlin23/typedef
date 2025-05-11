// src/components/Footer.tsx
import React from 'react';

const Footer: React.FC = () => (
  <footer className="bg-gray-800 py-6 mt-auto border-t border-gray-700"> {/* mt-auto for sticky footer effect with flex parent */}
    <div className="container mx-auto px-4 text-center">
      <p className="text-sm text-gray-400">
          Powered by <span className="text-green-400">struct</span>
      </p>
      <div className="flex justify-center mt-2">
        <a 
          href="https://github.com/evanlin23/typedef" // Assuming this is the correct repo
          target="_blank" 
          rel="noopener noreferrer"
          className="text-purple-400 hover:text-purple-300 hover:underline mx-2 transition-colors duration-150 text-sm"
        >
            View on GitHub
        </a>
      </div>
      {/* Optional: Copyright or other links */}
      {/* <p className="text-xs text-gray-500 mt-2">© {new Date().getFullYear()} Your App Name</p> */}
    </div>
  </footer>
);

export default Footer;