// src/components/UtilCard.tsx
import React from 'react';
import { Link } from 'react-router-dom'; // Assuming you're using React Router for navigation

interface UtilCardProps {
  title: string;
  description: string;
  linkTo: string;
  linkText?: string; // Optional: to customize the button text
}

const UtilCard: React.FC<UtilCardProps> = ({ title, description, linkTo, linkText = "Open Tool" }) => {
  return (
    <div className="bg-gray-700 p-6 rounded-lg shadow-md border border-gray-600 flex flex-col h-full">
      {/* Content Area */}
      <div className="flex-grow"> {/* This div will take up available space, pushing the button down */}
        <h2 className="text-xl font-semibold mb-3 text-orange-400">{title}</h2>
        <p className="text-gray-300 mb-4">
          {description}
        </p>
      </div>

      {/* Button Area - will be at the bottom */}
      <div className="mt-auto"> {/* mt-auto pushes this to the bottom if the parent is flex and has space */}
        <Link
          to={linkTo}
          className="block w-full bg-orange-500 hover:bg-orange-600 text-gray-100 text-center py-2 rounded transition-colors"
        >
          {linkText}
        </Link>
      </div>
    </div>
  );
};

export default UtilCard;