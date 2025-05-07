// src/components/Test.tsx
import React, { memo } from 'react';
import Character from './Character';
import TestResults from './TestResults';
import { useGame } from '../context/GameContext';

const Test: React.FC = memo(() => {
  const { state } = useGame();
  const { words, input, testCompleted } = state;
  
  if (!words || words.length === 0) {
    return <div className="loading">Loading words...</div>;
  }

  if (testCompleted) {
    return <TestResults />;
  }

  const wordObj = words[0];
  const word = wordObj?.word || 'Loading...';
  const definition = wordObj?.definition || '';
  const currentPosition = input.length;

  // Renders the definition with proper cursor positioning
  const renderDefinition = () => {
    // Split on word boundaries but keep the spaces with the preceding word
    const wordsWithSpaces = definition.match(/\S+\s*/g) || [];
    
    let charIndex = 0;
    
    return wordsWithSpaces.map((wordChars, wordIndex) => {
      if (!wordChars) return null;
      
      const wordElements = wordChars.split('').map((char) => {
        const currentCharIndex = charIndex++;
        const shouldRenderCursor = currentCharIndex === currentPosition;

        return (
          <React.Fragment key={currentCharIndex}>
            {shouldRenderCursor && <span className="typing-cursor"></span>}
            <Character
              character={char}
              input={input}
              charIndex={currentCharIndex}
            />
          </React.Fragment>
        );
      });

      return (
        <span 
          key={`word-${wordIndex}`} 
          className="word-wrapper"
        >
          {wordElements}
        </span>
      );
    });
  };

  return (
    <div className="test">
      <div className="word-display">
        <h1 className="word-to-type">{word}</h1>
          <span className="continue-prompt"><kbd>Tab</kbd> + <kbd>Enter</kbd> to skip</span>
      </div>
      
      <div className="definition">
        {renderDefinition()}
      </div>
    </div>
  );
});

export default Test;