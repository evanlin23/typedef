// src/components/Footer.tsx
import React from 'react';
import { useGame } from '../context/GameContext';

const Footer: React.FC = () => {
  const { state } = useGame();
  
  return (
    <footer className="footer">      
      <div className="stats">
        <div className="stat">
          <span className="label">Time:</span>
          <span className="value">{state.time}s</span>
        </div>
        <div className="stat">
          <span className="label">Score:</span>
          <span className="value">{state.score}</span>
        </div>
        <div className="stat">
          <span className="label">Errors:</span>
          <span className="value">{state.errors}</span>
        </div>
        {state.nextWord && (
          <div className="stat">
            <span className="label">Next:</span>
            <span className="value preloaded">Ready</span>
          </div>
        )}
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
};

export default Footer;