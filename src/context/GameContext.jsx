// src/context/GameContext.jsx
import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import wordGenerator from '../utils/wordGenerator';

const GameContext = createContext();

const initialState = {
  status: 'loading', // loading, ready, error
  words: [],
  input: [], // Flat array of characters
  time: 0,
  score: 0,
  errors: 0,
  testHistory: [],
  testCompleted: false,
  timerActive: false,
  startTime: null,
  currentTestStats: null,
};

function gameReducer(state, action) {
  switch (action.type) {
    case 'SET_STATUS':
      return { ...state, status: action.payload };
      
    case 'SET_WORDS':
      return { 
        ...state, 
        words: action.payload, 
        status: 'ready',
        input: [],
        testCompleted: false,
        timerActive: false,
        startTime: null,
      };
      
    case 'SET_INPUT': {
      // Start timer when first character is typed
      if (state.input.length === 0 && action.payload.length > 0 && !state.timerActive) {
        return {
          ...state,
          input: action.payload,
          timerActive: true,
          startTime: Date.now(),
        };
      }

      // Handle backspace - adjust score if removing correct character
      if (action.payload.length < state.input.length) {
        const definitionChars = state.words[0]?.definition?.split('') || [];
        const removedIndex = state.input.length - 1;
        
        if (definitionChars[removedIndex] === state.input[removedIndex]) {
          return {
            ...state,
            input: action.payload,
            score: Math.max(0, state.score - 1)
          };
        }
      }

      return { ...state, input: action.payload };
    }
      
    case 'INCREMENT_TIME':
      return state.timerActive ? { ...state, time: state.time + 1 } : state;
      
    case 'INCREMENT_SCORE':
      return { ...state, score: state.score + 1 };
      
    case 'INCREMENT_ERRORS':
      return { ...state, errors: state.errors + 1 };
      
    case 'SET_ERROR':
      return { ...state, status: 'error', error: action.payload };
      
    case 'COMPLETE_TEST': {
      // Get current word data
      const wordObj = state.words[0] || {};
      const word = wordObj.word || '';
      const currentDefinition = wordObj.definition || '';
      
      // Calculate statistics
      const endTime = Date.now();
      const elapsedTimeInSeconds = Math.max(1, Math.floor((endTime - (state.startTime || endTime)) / 1000));
      const totalChars = currentDefinition.length || 1;
      const accuracyValue = ((state.score / (totalChars + state.errors)) * 100).toFixed(1);
      const wpmValue = Math.round((state.score / 5) / (elapsedTimeInSeconds / 60));
      
      // Build test result object
      const testResult = {
        word,
        definition: currentDefinition,
        time: elapsedTimeInSeconds,
        accuracy: parseFloat(accuracyValue),
        wpm: wpmValue,
        errors: state.errors,
        correct: state.score,
        timestamp: new Date().toISOString(),
      };
      
      return {
        ...state,
        testCompleted: true,
        timerActive: false,
        testHistory: [...state.testHistory, testResult],
        currentTestStats: testResult,
      };
    }
      
    case 'START_NEW_TEST':
      return {
        ...state,
        score: 0,
        errors: 0,
        time: 0,
        input: [],
        testCompleted: false,
        timerActive: false,
        startTime: null,
        currentTestStats: null,
        status: 'loading',
      };
      
    default:
      return state;
  }
}

export const GameProvider = ({ children }) => {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const wordLoadingInProgress = useRef(false);

  // Load words when needed
  useEffect(() => {
    if (state.status === 'loading' && !wordLoadingInProgress.current) {
      const loadWords = async () => {
        wordLoadingInProgress.current = true;
        
        try {
          const words = await wordGenerator.generate();
          dispatch({ type: 'SET_WORDS', payload: words });
        } catch (error) {
          console.error("Error loading words:", error);
          dispatch({ type: 'SET_ERROR', payload: error.message });
        } finally {
          wordLoadingInProgress.current = false;
        }
      };
      
      loadWords();
    }
  }, [state.status]);

  // Timer effect - update time every second
  useEffect(() => {
    let timer;
    
    if (state.timerActive && !state.testCompleted) {
      timer = setInterval(() => {
        dispatch({ type: 'INCREMENT_TIME' });
      }, 1000);
    }
    
    return () => clearInterval(timer);
  }, [state.timerActive, state.testCompleted]);

  return (
    <GameContext.Provider value={{ state, dispatch }}>
      {children}
    </GameContext.Provider>
  );
};

export const useGame = () => useContext(GameContext);