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
          
          // Extract the actual word and space from the text
          const actualWord = wordObj.text.trimEnd();
          const hasSpace = wordObj.text.endsWith(' ');
          
          // For both active and completed words, we need to show characters
          const renderedChars = Array.from(actualWord).map((char, charIndex) => {
            let status = 'untouched';
            
            // Get character status if it exists
            if (charIndex < wordObj.characters.length) {
              status = wordObj.characters[charIndex];
            }
            
            // Only show cursor within the word if it belongs at this position
            const showCursor = isActiveWord && charIndex === input.length;
            
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
          
          // Add overflow characters for both active and completed words
          if ((isActiveWord && input.length > actualWord.length) || 
              (!isActiveWord && wordObj.status === 'completed' && wordObj.overflow && wordObj.overflow.length > 0)) {
            
            const overflowText = isActiveWord ? input.substring(actualWord.length) : wordObj.overflow || '';
            
            for (let i = 0; i < overflowText.length; i++) {
              const overflowChar = overflowText[i] || '';
              
              // Only add cursor for active word at the right position
              const showOverflowCursor = isActiveWord && actualWord.length + i === input.length;
              
              renderedChars.push(
                <React.Fragment key={`overflow-${i}`}>
                  {showOverflowCursor && <span className="typing-cursor"></span>}
                  <Character 
                    character={overflowChar}
                    status="overflow"
                  />
                </React.Fragment>
              );
            }
          }

          // Show cursor at the end of the word/overflow if needed
          const showEndCursor = isActiveWord && input.length === (
            actualWord.length + 
            (isActiveWord ? (input.substring(actualWord.length)).length : (wordObj.overflow || '').length)
          );

          // Add the space separately after all the renderedChars (including overflow chars)
          // Only add space for non-last words or if the original text had a space
          const isLastWord = wordIndex === definitionWords.length - 1;
          const spaceChar = hasSpace || !isLastWord ? (
            <React.Fragment>
              {showEndCursor && <span className="typing-cursor"></span>}
              <Character 
                key="space"
                character=" "
                status={wordObj.status === 'completed' ? 'correct' : 'untouched'}
              />
            </React.Fragment>
          ) : (
            showEndCursor && <span className="typing-cursor"></span>
          );

          return (
            <span 
              key={`word-${wordIndex}`} 
              className={wordClassName}
            >
              {renderedChars}
              {spaceChar}
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