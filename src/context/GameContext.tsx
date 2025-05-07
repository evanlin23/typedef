// src/context/GameContext.tsx
import React, { createContext, useContext, useReducer, useEffect, useRef, ReactNode } from 'react';
import wordGenerator from '../utils/wordGenerator';
import { GameState, GameAction, GameContextType, WordObj } from '../types';

const GameContext = createContext<GameContextType | undefined>(undefined);

const initialState: GameState = {
  status: 'loading', // loading, ready, error
  words: [],
  nextWord: null,
  isLoadingNext: false,
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

function gameReducer(state: GameState, action: GameAction): GameState {
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
      
    case 'SET_NEXT_WORD':
      return {
        ...state,
        nextWord: action.payload,
        isLoadingNext: false,
      };
      
    case 'SET_LOADING_NEXT':
      return {
        ...state,
        isLoadingNext: action.payload,
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
      
    case 'SKIP_CURRENT_WORD': {
      // Use the preloaded word if available
      if (state.nextWord) {
        return {
          ...state,
          words: [state.nextWord],
          nextWord: null,
          score: 0,
          errors: 0,
          time: 0,
          input: [],
          testCompleted: false,
          timerActive: false,
          startTime: null,
          currentTestStats: null,
          status: 'ready',
        };
      } else {
        // If no preloaded word, just start a new test
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
      }
    }
      
    case 'START_NEW_TEST':
      // Use the preloaded word if available
      if (state.nextWord) {
        return {
          ...state,
          words: [state.nextWord],
          nextWord: null,
          score: 0,
          errors: 0,
          time: 0,
          input: [],
          testCompleted: false,
          timerActive: false,
          startTime: null,
          currentTestStats: null,
          status: 'ready',
        };
      } else {
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
      }
      
    default:
      return state;
  }
}

interface GameProviderProps {
  children: ReactNode;
}

export const GameProvider: React.FC<GameProviderProps> = ({ children }) => {
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
          dispatch({ 
            type: 'SET_ERROR', 
            payload: error instanceof Error ? error.message : 'Unknown error' 
          });
        } finally {
          wordLoadingInProgress.current = false;
        }
      };
      
      loadWords();
    }
  }, [state.status]);

  // Preload next word
  useEffect(() => {
    // Start preloading when the current word is ready and we're not already loading
    if (state.status === 'ready' && !state.nextWord && !state.isLoadingNext && !state.testCompleted) {
      const preloadNextWord = async () => {
        dispatch({ type: 'SET_LOADING_NEXT', payload: true });
        
        try {
          const nextWord = await wordGenerator.generate();
          dispatch({ type: 'SET_NEXT_WORD', payload: nextWord[0] });
        } catch (error) {
          console.error("Error preloading next word:", error);
          // Silently fail on preload - we'll try again later
        }
      };
      
      preloadNextWord();
    }
  }, [state.status, state.nextWord, state.isLoadingNext, state.testCompleted]);

  // Timer effect - update time every second
  useEffect(() => {
    let timer: number | undefined;
    
    if (state.timerActive && !state.testCompleted) {
      timer = window.setInterval(() => {
        dispatch({ type: 'INCREMENT_TIME' });
      }, 1000);
    }
    
    return () => {
      if (timer !== undefined) {
        clearInterval(timer);
      }
    };
  }, [state.timerActive, state.testCompleted]);

  return (
    <GameContext.Provider value={{ state, dispatch }}>
      {children}
    </GameContext.Provider>
  );
};

export const useGame = (): GameContextType => {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};