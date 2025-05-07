// src/context/GameContext.jsx
import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import wordGenerator from '../utils/wordGenerator';

const GameContext = createContext();

const initialState = {
  status: 'loading',
  words: [],
  input: [], // Flat array of characters
  time: 0,
  score: 0,
  errors: 0,
  testHistory: [], // History of completed tests
  testCompleted: false, // Flag to indicate if current test is completed
  timerActive: false, // Track if timer is active
  startTime: null, // When the current test started
  currentTestStats: null, // Stats for the current test
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
      
    case 'SET_INPUT':
      // When first character is typed, start the timer
      if (state.input.length === 0 && action.payload.length > 0 && !state.timerActive) {
        return {
          ...state,
          input: action.payload,
          timerActive: true,
          startTime: Date.now(),
        };
      }
      return { ...state, input: action.payload };
      
    case 'INCREMENT_TIME':
      if (state.timerActive) {
        return { ...state, time: state.time + 1 };
      }
      return state;
      
    case 'INCREMENT_SCORE':
      return { ...state, score: state.score + 1 };
      
    case 'INCREMENT_ERRORS':
      return { ...state, errors: state.errors + 1 };
      
    case 'SET_ERROR':
      return { ...state, status: 'error', error: action.payload };
      
    case 'COMPLETE_TEST':
      // Get current word data
      const wordObj = state.words[0] || {};
      const word = wordObj.word || '';
      const currentDefinition = wordObj.definition || '';
      
      // Calculate elapsed time (minimum 1 second to avoid division by zero)
      const endTime = Date.now();
      const elapsedTimeInSeconds = Math.max(1, Math.floor((endTime - (state.startTime || endTime)) / 1000));
      
      // Calculate accuracy
      const totalChars = currentDefinition.length || 1; // Avoid division by zero
      const accuracyValue = ((state.score / (totalChars + state.errors)) * 100).toFixed(1);
      
      // Calculate WPM (words per minute)
      // Standard: 5 characters = 1 word
      const wpmValue = Math.round((state.score / 5) / (elapsedTimeInSeconds / 60));
      
      // Build test result object
      const testResult = {
        word: word,
        definition: currentDefinition,
        time: elapsedTimeInSeconds,
        accuracy: parseFloat(accuracyValue),
        wpm: wpmValue,
        errors: state.errors,
        correct: state.score,
        timestamp: new Date().toISOString(),
      };
      
      console.log("Test completed with stats:", testResult);
      
      return {
        ...state,
        testCompleted: true,
        timerActive: false,
        testHistory: [...state.testHistory, testResult],
        currentTestStats: testResult,
      };
      
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
        currentTestStats: null, // Clear the stats for the next test
        status: 'loading', // Set status to loading to trigger new word fetch
      };
      
    default:
      return state;
  }
}

export const GameProvider = ({ children }) => {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const initialLoadCompleted = useRef(false);

  // Load initial words - use useRef to prevent double loading
  useEffect(() => {
    // Only load words if we're in loading state and haven't loaded words yet
    if (state.status === 'loading' && !initialLoadCompleted.current) {
      const loadWords = async () => {
        try {
          console.log("Fetching new words...");
          const words = await wordGenerator.generate();
          dispatch({ type: 'SET_WORDS', payload: words });
          initialLoadCompleted.current = true;
        } catch (error) {
          console.error("Error loading words:", error);
          dispatch({ type: 'SET_ERROR', payload: error.message });
        }
      };
      
      loadWords();
    }
  }, [state.status]);

  // Handle loading new words for subsequent tests
  useEffect(() => {
    if (state.status === 'loading' && initialLoadCompleted.current) {
      const loadNextWord = async () => {
        try {
          console.log("Loading next word...");
          const words = await wordGenerator.generate();
          dispatch({ type: 'SET_WORDS', payload: words });
        } catch (error) {
          console.error("Error loading next word:", error);
          dispatch({ type: 'SET_ERROR', payload: error.message });
        }
      };
      
      loadNextWord();
    }
  }, [state.status]);

  // Timer effect - update elapsed time every second
  useEffect(() => {
    let timer;
    
    if (state.timerActive && !state.testCompleted) {
      timer = setInterval(() => {
        dispatch({ type: 'INCREMENT_TIME' });
      }, 1000);
    }
    
    return () => clearInterval(timer);
  }, [state.timerActive, state.testCompleted]);

  console.log("Current state:", {
    status: state.status,
    testCompleted: state.testCompleted,
    hasCurrentStats: !!state.currentTestStats,
    wordCount: state.words.length
  });

  return (
    <GameContext.Provider value={{ state, dispatch }}>
      {children}
    </GameContext.Provider>
  );
};

export const useGame = () => useContext(GameContext);