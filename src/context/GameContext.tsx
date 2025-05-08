// src/context/GameContext.tsx 
import React, { createContext, useContext, useReducer, useEffect, useRef, ReactNode } from 'react';
import wordGenerator from '../utils/wordGenerator';
import { GameState, GameAction, GameContextType, Word, TestResult } from '../types';
import { CharacterStatus } from '../types';

const GameContext = createContext<GameContextType | undefined>(undefined);

const initialState: GameState = {
  status: 'loading', // loading, ready, error
  words: [],
  nextWord: null,
  isLoadingNext: false,
  input: '',
  currentWordIndex: 0,
  definitionWords: [],
  time: 0,
  score: 0,
  errors: 0,
  testHistory: [],
  testCompleted: false,
  timerActive: false,
  startTime: null,
  currentTestStats: null,
  error: null,
};

// Helper function to split definition into words
const splitDefinitionIntoWords = (definition: string): Word[] => {
  if (!definition) return [];
  
  // Split by spaces but preserve spaces with the preceding word
  const wordTexts = definition.match(/\S+\s*/g) || [];
  
  return wordTexts.map((wordText, index) => ({
    text: wordText,
    status: index === 0 ? 'active' : 'upcoming',
    characters: Array(wordText.length).fill('untouched') as CharacterStatus[],
    overflow: ''
  }));
};

// Helper function to update character statuses based on input
const updateCharacterStatuses = (input: string, wordText: string): CharacterStatus[] => {
  const trimmedWord = wordText.trimEnd();
  const wordChars = Array.from(trimmedWord);
  const updatedCharStatus = Array(wordChars.length).fill('untouched') as CharacterStatus[];
  
  for (let i = 0; i < input.length; i++) {
    if (i < wordChars.length) {
      updatedCharStatus[i] = input[i] === wordChars[i] ? 'correct' : 'incorrect';
    }
  }
  
  return updatedCharStatus;
};

// Helper function to calculate score change when typing a new character
const calculateScoreChange = (
  input: string, 
  prevInput: string, 
  wordChars: string[]
): { scoreChange: number, errorChange: number } => {
  if (input.length > prevInput.length) {
    // New character added
    const newCharIndex = input.length - 1;
    const isWithinWord = newCharIndex < wordChars.length;
    const isCorrect = isWithinWord && input[newCharIndex] === wordChars[newCharIndex];
    
    return {
      scoreChange: isCorrect ? 1 : 0,
      errorChange: isCorrect ? 0 : 1
    };
  } else if (input.length < prevInput.length) {
    // Character removed (backspace)
    const removedIndex = prevInput.length - 1;
    const wasCorrect = removedIndex < wordChars.length && 
                      wordChars[removedIndex] === prevInput[removedIndex];
    
    return {
      scoreChange: wasCorrect ? -1 : 0,
      errorChange: 0
    };
  }
  
  return { scoreChange: 0, errorChange: 0 };
};

function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'SET_STATUS':
      return { ...state, status: action.payload };
      
    case 'SET_WORDS': {
      const definition = action.payload[0]?.definition || '';
      const definitionWords = splitDefinitionIntoWords(definition);
      
      return { 
        ...state, 
        words: action.payload,
        definitionWords,
        currentWordIndex: 0,
        input: '',
        status: 'ready',
        testCompleted: false,
        timerActive: false,
        startTime: null,
        error: null,
      };
    }
      
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
      const newInput = action.payload;
      const activeWord = state.definitionWords[state.currentWordIndex];
      
      if (!activeWord) return state;
      
      // Initialize timer on first character typed
      const timerState = state.input.length === 0 && newInput.length > 0 && !state.timerActive
        ? { timerActive: true, startTime: Date.now() }
        : {};
        
      const nextState = { 
        ...state, 
        input: newInput,
        ...timerState,
      };
      
      const trimmedWord = activeWord.text.trimEnd();
      const wordChars = Array.from(trimmedWord);
      
      // Short circuit for single-character words
      if (trimmedWord.length === 1 && newInput.length >= 1) {
        const isCorrect = newInput[0] === trimmedWord[0];
        
        if (isCorrect) {
          const updatedWords = [...nextState.definitionWords];
          updatedWords[nextState.currentWordIndex] = {
            ...activeWord,
            characters: ['correct']
          };
          
          const stateWithUpdatedChar = {
            ...nextState,
            definitionWords: updatedWords,
            score: nextState.score + 1
          };
          
          // Handle quick completion
          if (newInput.length > 1 || (
              newInput === trimmedWord[0] && 
              nextState.currentWordIndex === nextState.definitionWords.length - 1)) {
            return nextState.currentWordIndex === nextState.definitionWords.length - 1 
              ? gameReducer(stateWithUpdatedChar, { type: 'COMPLETE_TEST' })
              : gameReducer(stateWithUpdatedChar, { type: 'MOVE_TO_NEXT_WORD' });
          }
          
          return stateWithUpdatedChar;
        }
      }
      
      // Process character statuses
      const updatedWords = [...nextState.definitionWords];
      const currentWord = { ...updatedWords[nextState.currentWordIndex] };
      
      // Update character statuses
      currentWord.characters = updateCharacterStatuses(newInput, currentWord.text);
      updatedWords[nextState.currentWordIndex] = currentWord;
      
      // Calculate score and error changes
      const { scoreChange, errorChange } = calculateScoreChange(
        newInput, 
        state.input, 
        wordChars
      );
      
      return {
        ...nextState,
        definitionWords: updatedWords,
        score: Math.max(0, nextState.score + scoreChange),
        errors: nextState.errors + errorChange,
      };
    }
      
    case 'MOVE_TO_NEXT_WORD': {
      if (state.currentWordIndex >= state.definitionWords.length - 1) {
        return gameReducer(state, { type: 'COMPLETE_TEST' });
      }
      
      const updatedWords = [...state.definitionWords];
      const currentWord = updatedWords[state.currentWordIndex];
      const currentWordText = currentWord.text.trimEnd();
      
      // Store overflow characters
      const overflow = state.input.length > currentWordText.length 
        ? state.input.substring(currentWordText.length)
        : '';
      
      // Update word statuses
      updatedWords[state.currentWordIndex] = {
        ...currentWord,
        status: 'completed',
        overflow
      };
      
      const nextWordIndex = state.currentWordIndex + 1;
      if (nextWordIndex < updatedWords.length) {
        updatedWords[nextWordIndex] = {
          ...updatedWords[nextWordIndex],
          status: 'active'
        };
      }
      
      return {
        ...state,
        currentWordIndex: nextWordIndex,
        input: '',
        definitionWords: updatedWords
      };
    }
      
    case 'INCREMENT_TIME':
      return state.timerActive ? { ...state, time: state.time + 1 } : state;
      
    case 'SET_ERROR':
      return { ...state, status: 'error', error: action.payload };
      
    case 'COMPLETE_TEST': {
      // Get current word data
      const wordObj = state.words[0];
      const word = wordObj?.word || '';
      const currentDefinition = wordObj?.definition || '';
      
      // Calculate statistics
      const endTime = Date.now();
      const elapsedTimeInSeconds = Math.max(1, Math.floor((endTime - (state.startTime || endTime)) / 1000));
      const totalCorrectChars = state.score;
      const totalErrors = state.errors;
      const totalChars = totalCorrectChars + totalErrors;
      
      const accuracy = totalChars > 0 
        ? parseFloat(((totalCorrectChars / totalChars) * 100).toFixed(1)) 
        : 100;
      const wpm = Math.round((totalCorrectChars / 5) / (elapsedTimeInSeconds / 60));
      
      // Build test result object
      const testResult: TestResult = {
        word,
        definition: currentDefinition,
        time: elapsedTimeInSeconds,
        accuracy,
        wpm,
        errors: totalErrors,
        correct: totalCorrectChars,
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
      
    case 'SKIP_CURRENT_WORD':
    case 'START_NEW_TEST': {
      const baseState = {
        ...state,
        score: 0,
        errors: 0,
        time: 0,
        input: '',
        currentWordIndex: 0,
        testCompleted: false,
        timerActive: false,
        startTime: null,
        currentTestStats: null,
      };
      
      // Use the preloaded word if available
      if (state.nextWord) {
        const definition = state.nextWord.definition || '';
        const definitionWords = splitDefinitionIntoWords(definition);
        
        return {
          ...baseState,
          words: [state.nextWord],
          definitionWords,
          nextWord: null,
          status: 'ready',
        };
      } else {
        return {
          ...baseState,
          status: 'loading',
        };
      }
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

  // Handle automatic word completion when input matches word
  useEffect(() => {
    const currentWord = state.definitionWords[state.currentWordIndex];
    if (state.currentWordIndex !== state.definitionWords.length - 1) return;
    if (currentWord && !state.testCompleted && state.input) {
      const trimmedWord = currentWord.text.trimEnd();
      if (state.input === trimmedWord) {
        dispatch({ type: 'COMPLETE_TEST' });
      }
    }
  }, [state.input, state.currentWordIndex, state.definitionWords, state.testCompleted]);

  // Load words when needed
  useEffect(() => {
    const loadWords = async () => {
      if (state.status !== 'loading' || wordLoadingInProgress.current) return;
      
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
  }, [state.status]);

  // Preload next word
  useEffect(() => {
    const shouldPreload = state.status === 'ready' && 
                         !state.nextWord && 
                         !state.isLoadingNext && 
                         !state.testCompleted;
    
    if (!shouldPreload) return;
    
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
  }, [state.status, state.nextWord, state.isLoadingNext, state.testCompleted]);

  // Timer effect - update time every second
  useEffect(() => {
    if (!state.timerActive || state.testCompleted) return;
    
    const timer = setInterval(() => {
      dispatch({ type: 'INCREMENT_TIME' });
    }, 1000);
    
    return () => clearInterval(timer);
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