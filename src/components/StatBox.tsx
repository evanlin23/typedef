// src/components/StatBox.tsx
import React from 'react';

interface StatBoxProps {
  value: string | number;
  label: string;
}

const StatBox: React.FC<StatBoxProps> = ({ value, label }) => {
  return (
    <div className="bg-bg-primary p-4 rounded shadow">
      <div className="text-2xl font-bold mb-1 text-text-primary">{value}</div>
      <div className="text-sm text-text-secondary uppercase tracking-wide">{label}</div>
    </div>
  );
};

export default StatBox;