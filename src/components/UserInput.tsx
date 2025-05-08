// src/components/UserInput.tsx
import React, { useCallback, useEffect, useState } from 'react';
import { useGame } from '../context/GameContext';

const UserInput: React.FC = () => {
  const { state, dispatch } = useGame();
  const [tabPressed, setTabPressed] = useState(false);
  
  const handleKeyPress = useCallback((e: KeyboardEvent) => {
    e.preventDefault();

    // Handle tab key press
    if (e.key === 'Tab') {
      setTabPressed(true);
      return;
    }

    // Handle tab + enter combination for skipping
    if (tabPressed && e.key === 'Enter') {
      dispatch({ type: 'SKIP_CURRENT_WORD' });
      setTabPressed(false);
      return;
    }

    // Reset tab state when any other key is pressed
    if (tabPressed) {
      setTabPressed(false);
    }

    // For completed test, handle restart
    if (state.testCompleted) {
      if (e.key === 'Enter') {
        dispatch({ type: 'START_NEW_TEST' });
      }
      return;
    }

    // Only handle input when game is ready
    if (state.status !== 'ready') return;

    // Get current active word
    const activeWord = state.definitionWords[state.currentWordIndex];
    if (!activeWord) return;

    // Handle space key to move to next word
    if (e.key === ' ') {
      if (state.input.length > 0) {
        dispatch({ type: 'MOVE_TO_NEXT_WORD' });
      }
      return;
    }

    // Handle backspace
    if (e.key === 'Backspace') {
      if (state.input.length > 0) {
        const newInput = state.input.slice(0, -1);
        dispatch({ type: 'SET_INPUT', payload: newInput });
      }
      return;
    }

    // Ignore modifier keys and special commands
    if (e.ctrlKey || e.altKey || e.metaKey || e.key.length > 1) {
      return;
    }

    // Get the word without trailing space for length comparison
    const wordText = activeWord.text.trimEnd();
    
    // Don't allow more than MAX_OVERFLOW_CHARS extra characters per word
    const maxLength = wordText.length + 19;
    if (state.input.length >= maxLength) return;

    // Handle regular input - add character to current input
    dispatch({ type: 'SET_INPUT', payload: state.input + e.key });
    
  }, [state.input, state.status, state.testCompleted, state.definitionWords, state.currentWordIndex, dispatch, tabPressed]);

  // Add keyboard listener
  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);

  // Hidden input to maintain focus for keyboard input
  return (
    <input
      type="text"
      autoFocus
      className="sr-only"
      value={state.input}
      onChange={() => {}}
      aria-label="Typing input"
    />
  );
};

export default UserInput;