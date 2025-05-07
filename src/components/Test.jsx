// src/components/Test.jsx
import React, { memo } from 'react';
import Character from './Character';
import TestResults from './TestResults';
import { useGame } from '../context/GameContext';

const Test = memo(() => {
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
    let cursorRendered = false;
    
    return wordsWithSpaces.map((wordChars, wordIndex) => {
      if (!wordChars) return null;
      
      const wordElements = wordChars.split('').map((char, charPosInWord) => {
        const currentCharIndex = charIndex++;
        const shouldRenderCursor = !cursorRendered && currentCharIndex === currentPosition;
        
        if (shouldRenderCursor) {
          cursorRendered = true;
        }

        return (
          <React.Fragment key={currentCharIndex}>
            {shouldRenderCursor && <span className="typing-cursor"></span>}
            <Character
              character={char}
              input={input}
              wordIndex={0}
              charIndex={currentCharIndex}
            />
          </React.Fragment>
        );
      });

      // Add cursor at end of word if needed
      if (!cursorRendered && charIndex === currentPosition) {
        cursorRendered = true;
        wordElements.push(<span key={`cursor-after-${wordIndex}`} className="typing-cursor"></span>);
      }

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
        <h2 className="word-to-type">{word}</h2>
      </div>
      
      <div className="definition">
        {renderDefinition()}
        {/* Show cursor at the very end if not rendered elsewhere */}
        {currentPosition === definition.length && !definition.endsWith(' ') && 
          <span className="typing-cursor"></span>
        }
      </div>
    </div>
  );
});

export default Test;