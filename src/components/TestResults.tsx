// src/components/TestResults.tsx
import React, { memo } from 'react';
import { useGame } from '../context/GameContext';
import StatBox from './StatBox';

const TestResults: React.FC = memo(() => {
  const { state } = useGame();
  
  if (!state.testCompleted) {
    return <div className="text-center py-8 text-lg text-gray-400">Test not completed yet...</div>;
  }
  
  if (!state.currentTestStats) {
    return <div className="text-center py-8 text-lg text-gray-400">Calculating your results...</div>;
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
    <div className="w-3/5 mx-auto bg-gray-800 p-8 rounded-lg mb-8 text-center animate-fadeIn">
      <h3 className="text-2xl mb-5 text-green-400">Test Completed!</h3>
      
      <div className="bg-gray-900 p-4 rounded mb-6 inline-block min-w-52">
        <span className="font-bold mr-2 text-gray-400">Word:</span> 
        <span className="text-xl font-mono text-gray-200">{word}</span>
      </div>
      
      <div className="grid grid-cols-3 gap-5 mb-8 sm:grid-cols-5">
        <StatBox value={`${time}s`} label="Time" />
        <StatBox value={wpm} label="WPM" />
        <StatBox value={`${accuracy}%`} label="Accuracy" />
        <StatBox value={correct} label="Correct" />
        <StatBox value={errors} label="Errors" />
      </div>
      
      <div className="text-gray-400 text-lg mt-6">
        Press <kbd className="bg-gray-700 rounded px-2 py-1 text-sm border border-gray-600 shadow mx-1">Enter</kbd> to continue
      </div>
    </div>
  );
});

export default TestResults;