// src/components/StatBox.tsx
import React from 'react';

interface StatBoxProps {
  value: string | number;
  label: string;
}

const StatBox: React.FC<StatBoxProps> = ({ value, label }) => {
  return (
    <div className="bg-gray-900 p-4 rounded shadow">
      <div className="text-2xl font-bold mb-1 text-gray-200">{value}</div>
      <div className="text-sm text-gray-400 uppercase tracking-wide">{label}</div>
    </div>
  );
};

export default StatBox;