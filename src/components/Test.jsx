// src/components/Test.jsx
import React, { memo, useEffect } from 'react';
import Character from './Character';
import TestResults from './TestResults';
import { useGame } from '../context/GameContext';

const Test = memo(({ words, input }) => {
  const { state } = useGame();
  
  // Debug: Log component state
  useEffect(() => {
    console.log("Test component state:", {
      hasWords: !!words && words.length > 0,
      testCompleted: state.testCompleted,
      hasStats: !!state.currentTestStats,
    });
  }, [words, state.testCompleted, state.currentTestStats]);
  
  if (!words || words.length === 0) {
    return <div className="loading">Loading words...</div>;
  }

  // If test is completed and we have stats, show results
  if (state.testCompleted === true) {
    console.log("Rendering test results");
    return <TestResults />;
  }

  const wordObj = words[0];
  const word = wordObj?.word || 'Loading...';
  const definition = wordObj?.definition || '';

  // Current position in the typing test
  const currentPosition = input.length;

  return (
    <div className="test">
      {/* Display the word but don't include it in the typing test */}
      <div className="word-display">
        <h2 className="word-to-type">{word}</h2>
      </div>
      
      <div className="definition">
        {/* Render characters and insert cursor at current position */}
        {definition.split('').map((char, index) => (
          <React.Fragment key={index}>
            {index === currentPosition && <span className="typing-cursor"></span>}
            <Character
              character={char}
              input={input}
              wordIndex={0}
              charIndex={index}
            />
          </React.Fragment>
        ))}
        {/* If cursor is at the end, show it there */}
        {currentPosition === definition.length && <span className="typing-cursor"></span>}
      </div>
    </div>
  );
});

export default Test;