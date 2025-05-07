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
    if (tabPressed && e.key !== 'Tab') {
      setTabPressed(false);
    }

    // For completed test, handle restart
    if (state.testCompleted) {
      if (e.key === ' ' || e.key === 'Enter') {
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
      // Only allow moving to next word if:
      // 1. At least one character has been typed
      // 2. Not already at max overflow characters
      if (state.input.length > 0 && 
          state.input.length <= activeWord.text.length + 19) {
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
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (e.key.length > 1) return; // Ignore special keys

    // Don't allow more than 19 extra characters per word
    const maxLength = activeWord.text.length + 19;
    if (state.input.length >= maxLength) return;

    // Handle regular input - add character to current input
    const newInput = state.input + e.key;
    dispatch({ type: 'SET_INPUT', payload: newInput });
    
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