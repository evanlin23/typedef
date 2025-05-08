// src/components/Footer.tsx
import React, { memo } from 'react';
import { useGame } from '../context/GameContext';

interface StatItemProps {
  label: string;
  value: React.ReactNode;
}

const StatItem: React.FC<StatItemProps> = memo(({ label, value }) => (
  <div className="stat">
    <span className="label">{label}:</span>
    <span className="value">{value}</span>
  </div>
));

StatItem.displayName = 'StatItem';

const Footer: React.FC = memo(() => {
  const { state } = useGame();
  
  return (
    <footer className="footer">      
      <div className="stats">
        <StatItem label="Time" value={`${state.time}s`} />
        <StatItem label="Score" value={state.score} />
        <StatItem label="Errors" value={state.errors} />
        <StatItem 
          label="Next" 
          value={state.nextWord ? (
            <span className="preloaded">Ready</span>
          ) : (
            "Loading..."
          )} 
        />
      </div>

      <div className="api-credits">
        Words from Random Word API • Definitions from Free Dictionary API
      </div>
      
      <div className="links">
        <a 
          href="https://github.com/evanlin23/typedef" 
          target="_blank" 
          rel="noopener noreferrer"
        >
          GitHub
        </a>
      </div>
    </footer>
  );
});

Footer.displayName = 'Footer';

export default Footer;