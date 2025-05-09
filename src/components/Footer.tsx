// src/components/Footer.tsx
import React, { memo } from 'react';
import { useGame } from '../context/GameContext';

interface StatItemProps {
  label: string;
  value: React.ReactNode;
}

const StatItem: React.FC<StatItemProps> = memo(({ label, value }) => (
  <div className="mx-4 text-center">
    <span className="font-bold mr-1 text-text-secondary">{label}:</span>
    <span>{value}</span>
  </div>
));

StatItem.displayName = 'StatItem';

const Footer: React.FC = memo(() => {
  const { state } = useGame();
  
  return (
    <footer className="mt-auto flex flex-col items-center text-text-secondary">      
      <div className="flex justify-center my-4">
        <StatItem label="Time" value={`${state.time}s`} />
        <StatItem label="Score" value={state.score} />
        <StatItem label="Errors" value={state.errors} />
        <StatItem 
          label="Next" 
          value={state.nextWord ? (
            <span className="text-accent-primary font-bold">Ready</span>
          ) : (
            "Loading..."
          )} 
        />
      </div>

      <div className="text-sm text-text-secondary mb-4">
        Words from Random Word API • Definitions from Free Dictionary API
      </div>
      
      <div className="flex justify-center">
        <a 
          href="https://github.com/evanlin23/typedef" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-accent-secondary hover:underline mx-2"
        >
          GitHub
        </a>
      </div>
    </footer>
  );
});

Footer.displayName = 'Footer';

export default Footer;