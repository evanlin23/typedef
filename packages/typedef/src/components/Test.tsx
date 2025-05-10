// src/components/Test.tsx
import React, { memo } from 'react';
import Character from './Character';
import TestResults from './TestResults';
import { useGame } from '../context/GameContext';
import { Word } from '../types';

interface CharWithCursorProps {
  character: string;
  status: string;
  showCursor: boolean;
}

// Helper component to render a character with optional cursor
const CharWithCursor: React.FC<CharWithCursorProps> = memo(({ character, status, showCursor }) => {
  return (
    <>
      {showCursor && (
        <span className="relative inline-block w-0.5 h-5 bg-text-primary animate-[caretFlash_1s_ease-in-out_infinite] align-middle pointer-events-none -ml-0.5 shadow-sm shadow-white/50">
          {/* The animation still doesn't work */}
        </span>
      )}
      <Character character={character} status={status} />
    </>
  );
});

const Test: React.FC = memo(() => {
  const { state } = useGame();
  const { words, definitionWords, currentWordIndex, testCompleted, input } = state;
  
  if (!words?.length) {
    return <div className="text-center py-8 text-lg text-text-secondary">Loading words...</div>;
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
    let wordClassName = "inline-block whitespace-nowrap leading-relaxed py-0.5 mr-0 relative";
    if (wordObj.status === 'active') wordClassName += ' active-word';
    if (wordObj.status === 'completed') wordClassName += ' completed-word';
    
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
      showEndCursor && <span className="relative inline-block w-0.5 h-5 bg-text-primary animate-[caretFlash_1s_ease-in-out_infinite] align-middle pointer-events-none -ml-0.5 shadow-sm shadow-white/50"></span>
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
      return <div className="text-text-secondary">Loading definition...</div>;
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
    <div className="p-8 rounded-lg mb-8 w-full flex flex-col items-center">
      <div className="text-center mb-5 flex flex-col items-center">
        <h1 className="text-3xl mb-5 text-text-primary">{word}</h1>
        <span className="text-text-secondary text-lg">
          <kbd className="bg-bg-secondary rounded px-2 py-1 text-sm border border-border-secondary shadow mx-2">Tab</kbd> 
          + 
          <kbd className="bg-bg-secondary rounded px-2 py-1 text-sm border border-border-secondary shadow mx-2">Enter</kbd> 
          to skip
        </span>
      </div>
      
      <div className="font-mono text-xl leading-relaxed whitespace-pre-wrap text-text-primary w-3/5">
        {renderDefinition()}
      </div>
    </div>
  );
});

export default Test;