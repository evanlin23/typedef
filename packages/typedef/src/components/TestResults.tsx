// src/components/TestResults.tsx
import React, { memo } from 'react';
import { useGame } from '../context/GameContext';
import StatBox from './StatBox';

const TestResults: React.FC = memo(() => {
  const { state } = useGame();
  
  if (!state.testCompleted) {
    return <div className="text-center py-8 text-lg text-text-secondary">Test not completed yet...</div>;
  }
  
  if (!state.currentTestStats) {
    return <div className="text-center py-8 text-lg text-text-secondary">Calculating your results...</div>;
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
    <div className="w-3/5 mx-auto bg-bg-secondary p-8 rounded-lg mb-8 text-center animate-[fadeIn_0.3s_ease-in_forwards]">
      <h3 className="text-2xl mb-5 text-accent-primary">Test Completed!</h3>
      
      <div className="bg-bg-primary p-4 rounded mb-6 inline-block min-w-52">
        <span className="font-bold mr-2 text-text-secondary">Word:</span> 
        <span className="text-xl font-mono text-text-primary">{word}</span>
      </div>
      
      <div className="grid grid-cols-3 gap-5 mb-8 sm:grid-cols-5">
        <StatBox value={`${time}s`} label="Time" />
        <StatBox value={wpm} label="WPM" />
        <StatBox value={`${accuracy}%`} label="Accuracy" />
        <StatBox value={correct} label="Correct" />
        <StatBox value={errors} label="Errors" />
      </div>
      
      <div className="text-text-secondary text-lg mt-6">
        Press <kbd className="bg-bg-secondary rounded px-2 py-1 text-sm border border-border-secondary shadow mx-1">Enter</kbd> to continue
      </div>
    </div>
  );
});

export default TestResults;