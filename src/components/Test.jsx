// src/components/Test.jsx
import React, { memo } from 'react';
import Character from './Character';
import TestResults from './TestResults';
import { useGame } from '../context/GameContext';

const Test = memo(({ words, input }) => {
  const { state } = useGame();
  
  if (!words || words.length === 0) {
    return <div className="loading">Loading words...</div>;
  }

  if (state.testCompleted === true) {
    return <TestResults />;
  }

  const wordObj = words[0];
  const word = wordObj?.word || 'Loading...';
  const definition = wordObj?.definition || '';

  const currentPosition = input.length;

  // Split the definition into words (including their trailing spaces)
  const renderDefinition = () => {
    // Split on word boundaries but keep the spaces with the preceding word
    const wordsWithSpaces = definition.match(/\S+\s*/g) || [];
    
    let charIndex = 0;
    return wordsWithSpaces.map((wordChars, wordIndex) => {
      if (wordChars === '') return null;
      
      const wordElements = wordChars.split('').map((char, charPosInWord) => {
        const currentCharIndex = charIndex++;
        
        return (
          <React.Fragment key={currentCharIndex}>
            {currentCharIndex === currentPosition && <span className="typing-cursor"></span>}
            <Character
              character={char}
              input={input}
              wordIndex={0}
              charIndex={currentCharIndex}
            />
          </React.Fragment>
        );
      });

      // Add cursor after the word if needed
      if (charIndex === currentPosition) {
        wordElements.push(<span key={`cursor-after-${wordIndex}`} className="typing-cursor"></span>);
      }

      return (
        <span 
          key={`word-${wordIndex}`} 
          className="word-wrapper"
          style={{ whiteSpace: 'nowrap' }}
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
        {/* If cursor is at the very end, show it there */}
        {currentPosition === definition.length && <span className="typing-cursor"></span>}
      </div>
    </div>
  );
});

export default Test;