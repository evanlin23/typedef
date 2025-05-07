// src/components/UserInput.jsx
import React, { useCallback, useEffect } from 'react';
import { useGame } from '../context/GameContext';

const UserInput = () => {
  const { state, dispatch } = useGame();
  const definition = state.words[0]?.definition || '';

  const handleKeyPress = useCallback((e) => {
    e.preventDefault();

    // If test is completed, pressing any key will load a new test
    if (state.testCompleted) {
      if (e.key === ' ' || e.key === 'Enter') {
        // console.log("Starting new test");
        dispatch({ type: 'START_NEW_TEST' });
      }
      return;
    }

    // Only handle input when game is ready
    if (state.status !== 'ready') return;

    // Handle backspace
    if (e.key === 'Backspace') {
      const newInput = state.input.slice(0, -1);
      dispatch({ type: 'SET_INPUT', payload: newInput });
      return;
    }

    // Ignore modifier keys and special commands
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (e.key.length > 1 && e.key !== ' ') return;

    // Handle regular input
    const newInput = [...state.input, e.key];

    // Validate character
    if (e.key === definition[state.input.length]) {
      dispatch({ type: 'INCREMENT_SCORE' });
    } else {
      dispatch({ type: 'INCREMENT_ERRORS' });
    }

    // Update input state
    dispatch({ type: 'SET_INPUT', payload: newInput });

    // Check if definition is completed
    if (newInput.length === definition.length) {
      // Mark test as complete and show stats
      // console.log("Definition completed, completing test");
      dispatch({ type: 'COMPLETE_TEST' });
    }
  }, [state.input, state.status, state.testCompleted, definition, dispatch]);

  // Add keyboard listener
  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);

  // Maintain focus for keyboard input
  return (
    <input
      type="text"
      autoFocus
      className="sr-only"
      value={state.input.join('')}
      onChange={() => {}}
    />
  );
};

export default UserInput;