// src/components/Footer.tsx
import React, { memo } from 'react';
import { useGame } from '../context/GameContext';

interface StatItemProps {
  label: string;
  value: React.ReactNode;
}

const StatItem: React.FC<StatItemProps> = memo(({ label, value }) => (
  <div className="mx-4 text-center">
    <span className="font-bold mr-1 text-gray-400">{label}:</span>
    <span>{value}</span>
  </div>
));

StatItem.displayName = 'StatItem';

const Footer: React.FC = memo(() => {
  const { state } = useGame();
  
  return (
    <footer className="mt-auto flex flex-col items-center text-gray-400">      
      <div className="flex justify-center my-4">
        <StatItem label="Time" value={`${state.time}s`} />
        <StatItem label="Score" value={state.score} />
        <StatItem label="Errors" value={state.errors} />
        <StatItem 
          label="Next" 
          value={state.nextWord ? (
            <span className="text-green-400 font-bold">Ready</span>
          ) : (
            "Loading..."
          )} 
        />
      </div>

      <div className="text-sm text-gray-500 mb-4">
        Words from Random Word API • Definitions from Free Dictionary API
      </div>
      
      <div className="flex justify-center">
        <a 
          href="https://github.com/evanlin23/typedef" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-blue-400 hover:underline mx-2"
        >
          GitHub
        </a>
      </div>
    </footer>
  );
});

Footer.displayName = 'Footer';

export default Footer;