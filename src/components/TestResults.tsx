// src/components/TestResults.tsx
import React, { memo } from 'react';
import { useGame } from '../context/GameContext';
import { APP_CONFIG } from '../config/app.config';

const TestResults: React.FC = memo(() => {
  const { state } = useGame();
  
  if (!state.testCompleted) {
    return <div className="loading">Test not completed yet...</div>;
  }
  
  if (!state.currentTestStats) {
    return <div className="loading">Calculating your results...</div>;
  }
  
  // Destructure with default values to prevent errors
  const { 
    word = 'Unknown', 
    time = 0, 
    accuracy = 0, 
    wpm = 0, 
    errors = 0, 
    correct = 0 
  } = state.currentTestStats;
  
  return (
    <div className="test-results">
      <h3>Test Completed!</h3>
      
      <div className="word-highlight">
        <span className="word-label">Word:</span> 
        <span className="word-value">{word}</span>
      </div>
      
      <div className="stats-grid">
        <div className="stat-item">
          <div className="stat-value">{time}s</div>
          <div className="stat-label">Time</div>
        </div>
        
        <div className="stat-item">
          <div className="stat-value">{wpm}</div>
          <div className="stat-label">WPM</div>
        </div>
        
        <div className="stat-item">
          <div className="stat-value">{accuracy}%</div>
          <div className="stat-label">Accuracy</div>
        </div>
        
        <div className="stat-item">
          <div className="stat-value">{correct}</div>
          <div className="stat-label">Correct</div>
        </div>
        
        <div className="stat-item">
          <div className="stat-value">{errors}</div>
          <div className="stat-label">Errors</div>
        </div>
      </div>
      
      <div className="continue-prompt">
        Press <kbd>{APP_CONFIG.KEYS.NEXT_TEST.join(' or ')}</kbd> to continue
      </div>
    </div>
  );
});

export default TestResults;