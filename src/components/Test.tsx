// src/components/Test.tsx
import React, { memo } from 'react';
import Character from './Character';
import TestResults from './TestResults';
import { useGame } from '../context/GameContext';
import { Word } from '../types';
import { APP_CONFIG } from '../config/app.config';

interface CharWithCursorProps {
  character: string;
  status: string;
  showCursor: boolean;
}

// Helper component to render a character with optional cursor
const CharWithCursor: React.FC<CharWithCursorProps> = memo(({ character, status, showCursor }) => {
  return (
    <>
      {showCursor && <span className="typing-cursor"></span>}
      <Character character={character} status={status} />
    </>
  );
});

const Test: React.FC = memo(() => {
  const { state } = useGame();
  const { words, definitionWords, currentWordIndex, testCompleted, input } = state;
  
  if (!words?.length) {
    return <div className="loading">Loading words...</div>;
  }

  if (testCompleted) {
    return <TestResults />;
  }

  const wordObj = words[0];
  const word = wordObj?.word || 'Loading...';
  
  // Helper function to determine where to show the cursor
  const getCursorPosition = (
    wordIndex: number, 
    charIndex: number
  ): { showCursor: boolean } => {
    if (wordIndex !== currentWordIndex) {
      return { showCursor: false };
    }
    
    const cursorPosition = input.length;
    return { 
      showCursor: charIndex === cursorPosition 
    };
  };
  
  // Render a single word with correct character statuses and cursor
  const renderWord = (wordObj: Word, wordIndex: number) => {
    const isActiveWord = wordIndex === currentWordIndex;
    
    // Calculate word display class
    const wordClassName = `word-wrapper${
      wordObj.status === 'active' ? ' active-word' : ''
    }${wordObj.status === 'completed' ? ' completed-word' : ''}`;
    
    // Extract the actual word and space from the text
    const actualWord = wordObj.text.trimEnd();
    const hasSpace = wordObj.text.endsWith(' ');
    
    // For both active and completed words, we need to show characters
    const renderedChars = Array.from(actualWord).map((char, charIndex) => {
      // Get character status
      const status = charIndex < wordObj.characters.length 
        ? wordObj.characters[charIndex] 
        : 'untouched';
      
      // Determine cursor position
      const { showCursor } = getCursorPosition(wordIndex, charIndex);
      
      return (
        <CharWithCursor
          key={charIndex}
          character={char}
          status={status}
          showCursor={showCursor}
        />
      );
    });
    
    // Add overflow characters if necessary
    const overflowText = isActiveWord 
      ? input.substring(actualWord.length) 
      : wordObj.overflow || '';
    
    if (overflowText.length > 0) {
      for (let i = 0; i < overflowText.length; i++) {
        const overflowChar = overflowText[i] || '';
        
        // Calculate cursor position for overflow characters
        const charIndex = actualWord.length + i;
        const { showCursor } = getCursorPosition(wordIndex, charIndex);
        
        renderedChars.push(
          <CharWithCursor
            key={`overflow-${i}`}
            character={overflowChar}
            status="overflow"
            showCursor={showCursor}
          />
        );
      }
    }

    // Show cursor at the end position if needed
    const finalCharIndex = actualWord.length + overflowText.length;
    const { showCursor: showEndCursor } = getCursorPosition(wordIndex, finalCharIndex);

    // Add the space separately after all characters
    // Only add space for non-last words or if the original text had a space
    const isLastWord = wordIndex === definitionWords.length - 1;
    const spaceChar = hasSpace || !isLastWord ? (
      <CharWithCursor
        key="space"
        character=" "
        status={wordObj.status === 'completed' ? 'correct' : 'untouched'}
        showCursor={showEndCursor}
      />
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
  };
  
  // Renders the definition words
  const renderDefinition = () => {
    if (!definitionWords?.length) {
      return <div>Loading definition...</div>;
    }

    return (
      <div>
        {definitionWords.map((wordObj, wordIndex) => 
          renderWord(wordObj, wordIndex)
        )}
      </div>
    );
  };

  return (
    <div className="test">
      <div className="word-display">
        <h1 className="word-to-type">{word}</h1>
        <span className="continue-prompt">
          <kbd>{APP_CONFIG.KEYS.SKIP_WORD[0]}</kbd> + <kbd>{APP_CONFIG.KEYS.SKIP_WORD[1]}</kbd> to skip
        </span>
      </div>
      
      <div className="definition">
        {renderDefinition()}
      </div>
    </div>
  );
});

export default Test;