// src/components/Test.tsx
import React, { memo } from 'react';
import Character from './Character';
import TestResults from './TestResults';
import { useGame } from '../context/GameContext';

const Test: React.FC = memo(() => {
  const { state } = useGame();
  const { words, definitionWords, currentWordIndex, testCompleted, input } = state;
  
  if (!words || words.length === 0) {
    return <div className="loading">Loading words...</div>;
  }

  if (testCompleted) {
    return <TestResults />;
  }

  const wordObj = words[0];
  const word = wordObj?.word || 'Loading...';
  
  // Renders the definition words
  const renderDefinition = () => {
    if (!definitionWords || definitionWords.length === 0) {
      return <div>Loading definition...</div>;
    }

    return (
      <div>
        {definitionWords.map((wordObj, wordIndex) => {
          const isActiveWord = wordIndex === currentWordIndex;
          
          // Calculate word display class
          let wordClassName = "word-wrapper";
          if (wordObj.status === 'active') wordClassName += " active-word";
          if (wordObj.status === 'completed') wordClassName += " completed-word";
          
          // For active word, we need to show cursor position
          const renderedChars = Array.from(wordObj.text).map((char, charIndex) => {
            // Only show cursor in active word
            const showCursor = isActiveWord && charIndex === input.length;
            
            let status = 'untouched';
            
            // Get character status if it exists
            if (charIndex < wordObj.characters.length) {
              status = wordObj.characters[charIndex];
            }
            
            return (
              <React.Fragment key={charIndex}>
                {showCursor && <span className="typing-cursor"></span>}
                <Character 
                  character={char}
                  status={status}
                />
              </React.Fragment>
            );
          });
          
          // Add overflow characters for active word
          if (isActiveWord && input.length > wordObj.text.length) {
            const overflowCount = Math.min(
              input.length - wordObj.text.length,
              19 // max overflow
            );
            
            for (let i = 0; i < overflowCount; i++) {
              const overflowIndex = wordObj.text.length + i;
              const overflowChar = input[overflowIndex] || '';
              
              if (overflowIndex === input.length) {
                renderedChars.push(
                  <React.Fragment key={`overflow-${i}`}>
                    <span className="typing-cursor"></span>
                    <Character 
                      character={overflowChar}
                      status="overflow"
                    />
                  </React.Fragment>
                );
              } else {
                renderedChars.push(
                  <Character 
                    key={`overflow-${i}`}
                    character={overflowChar}
                    status="overflow"
                  />
                );
              }
            }
            
            // If cursor should be at the end of overflow
            if (input.length === wordObj.text.length + overflowCount) {
              renderedChars.push(
                <span key="cursor-end" className="typing-cursor"></span>
              );
            }
          }

          return (
            <span 
              key={`word-${wordIndex}`} 
              className={wordClassName}
            >
              {renderedChars}
            </span>
          );
        })}
      </div>
    );
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