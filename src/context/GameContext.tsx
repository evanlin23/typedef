// src/context/GameContext.tsx 
import React, { createContext, useContext, useReducer, useEffect, useRef, ReactNode } from 'react';
import wordGenerator from '../utils/wordGenerator';
import { GameState, GameAction, GameContextType, Word, CharacterStatus } from '../types';

const GameContext = createContext<GameContextType | undefined>(undefined);

const MAX_OVERFLOW_CHARS = 19;

const initialState: GameState = {
  status: 'loading', // loading, ready, error
  words: [],
  nextWord: null,
  isLoadingNext: false,
  input: '', // Current input for the active word
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
};

// Helper function to split definition into words
const splitDefinitionIntoWords = (definition: string): Word[] => {
  if (!definition) return [];
  
  // Split by spaces but preserve spaces with the preceding word
  const wordTexts = definition.match(/\S+\s*/g) || [];
  
  return wordTexts.map((wordText, index) => ({
    text: wordText,
    status: index === 0 ? 'active' : 'upcoming',
    characters: Array.from(wordText).map((): CharacterStatus => 'untouched'),
    overflow: '' // Add overflow property to store extra characters
  }));
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
      
      // Start timer when first character is typed
      if (state.input.length === 0 && newInput.length > 0 && !state.timerActive) {
        return {
          ...state,
          input: newInput,
          timerActive: true,
          startTime: Date.now(),
        };
      }
      
      // Update the word's character status
      const updatedWords = [...state.definitionWords];
      const currentWord = {...updatedWords[state.currentWordIndex]};
      const wordChars = Array.from(currentWord.text.trimEnd()); // Trim the trailing space
      
      // For single character words, detect if we should auto-complete
      if (wordChars.length === 1 && newInput.length >= 1) {
        const isCorrect = newInput[0] === wordChars[0];
        
        // If character is correct, auto-complete after a short delay
        if (isCorrect) {
          // Mark the character as correct
          currentWord.characters = ['correct'];
          updatedWords[state.currentWordIndex] = currentWord;
          
          // Return state with updated character status
          const stateWithUpdatedChar = {
            ...state,
            input: newInput,
            definitionWords: updatedWords,
            score: state.score + 1
          };
          
          // Move to next word if there's overflow or this is the exact match
          if (newInput.length > 1 || (newInput === wordChars[0] && state.currentWordIndex === state.definitionWords.length - 1)) {
            // Use setTimeout to advance after a short delay
            setTimeout(() => {
              if (state.currentWordIndex === state.definitionWords.length - 1) {
                // Last word, complete the test
                dispatch({ type: 'COMPLETE_TEST' });
              } else {
                dispatch({ type: 'MOVE_TO_NEXT_WORD' });
              }
            }, 10);
          }
          
          return stateWithUpdatedChar;
        }
      }
      
      // Reset character statuses 
      const updatedCharStatus: CharacterStatus[] = Array(wordChars.length).fill('untouched');
      
      // Apply statuses based on input
      for (let i = 0; i < newInput.length; i++) {
        if (i < wordChars.length) {
          // Normal character comparison
          updatedCharStatus[i] = newInput[i] === wordChars[i] ? 'correct' : 'incorrect';
        } else if (i < wordChars.length + MAX_OVERFLOW_CHARS) {
          // Overflow characters within limit
          updatedCharStatus.push('overflow');
        }
      }
      
      currentWord.characters = updatedCharStatus;
      updatedWords[state.currentWordIndex] = currentWord;
      
      // Check if this completes the word - match the full word exactly
      const isExactMatch = newInput === wordChars.join('');
      
      // Check if this is the last word
      const isLastWord = state.currentWordIndex === state.definitionWords.length - 1;
      
      // Check if the word is considered completed (exact match with no space needed for last word)
      const isWordCompleted = newInput.length > wordChars.length || 
        (isExactMatch && (currentWord.text.endsWith(' ') || isLastWord));
      
      if (isWordCompleted && isLastWord) {
        // This was the last word and it's complete, finish the test
        setTimeout(() => {
          dispatch({ type: 'COMPLETE_TEST' });
        }, 10);
      } else if (isWordCompleted) {
        // Word is complete but not the last one, move to next word
        setTimeout(() => {
          dispatch({ type: 'MOVE_TO_NEXT_WORD' });
        }, 10);
      }
      
      // Determine if new input contains correct character that needs score update
      if (newInput.length > state.input.length) {
        const newCharIndex = newInput.length - 1;
        let scoreChange = 0;
        let errorChange = 0;
        
        if (newCharIndex < wordChars.length) {
          if (newInput[newCharIndex] === wordChars[newCharIndex]) {
            scoreChange = 1;
          } else {
            errorChange = 1;
          }
        } else {
          // Typing overflow characters adds to errors
          errorChange = 1;
        }
        
        return {
          ...state,
          input: newInput,
          definitionWords: updatedWords,
          score: state.score + scoreChange,
          errors: state.errors + errorChange
        };
      } else if (newInput.length < state.input.length) {
        // Backspace was pressed
        // Update score if needed - check if the removed character was correct
        const removedIndex = state.input.length - 1;
        
        // Only adjust score if we're within the actual word length
        let scoreAdjustment = 0;
        if (removedIndex < wordChars.length && wordChars[removedIndex] === state.input[removedIndex]) {
          scoreAdjustment = -1;
        }
        
        return {
          ...state,
          input: newInput,
          definitionWords: updatedWords,
          score: Math.max(0, state.score + scoreAdjustment)
        };
      }
      
      return {
        ...state,
        input: newInput,
        definitionWords: updatedWords
      };
    }
      
    case 'MOVE_TO_NEXT_WORD': {
      if (state.currentWordIndex >= state.definitionWords.length - 1) {
        // This was the last word, complete the test
        return gameReducer(state, { type: 'COMPLETE_TEST' });
      }
      
      // Update statuses of previous and next word
      const updatedWords = [...state.definitionWords];
      const currentWordText = updatedWords[state.currentWordIndex].text.trimEnd();
      
      // Store overflow characters from the input (ensuring we don't truncate if at max)
      let overflow = '';
      if (state.input.length > currentWordText.length) {
        overflow = state.input.substring(currentWordText.length);
        // No need to limit overflow here as UI handles the display
      }
      
      // Mark current word as completed but preserve character statuses and add overflow
      updatedWords[state.currentWordIndex] = {
        ...updatedWords[state.currentWordIndex],
        status: 'completed',
        overflow: overflow // Store the overflow characters
      };
      
      // Mark next word as active
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
      const totalCorrectChars = state.score;
      const totalErrors = state.errors;
      const totalChars = totalCorrectChars + totalErrors;
      
      const accuracyValue = totalChars > 0 ? ((totalCorrectChars / totalChars) * 100).toFixed(1) : "100.0";
      const wpmValue = Math.round((totalCorrectChars / 5) / (elapsedTimeInSeconds / 60));
      
      // Build test result object
      const testResult = {
        word,
        definition: currentDefinition,
        time: elapsedTimeInSeconds,
        accuracy: parseFloat(accuracyValue),
        wpm: wpmValue,
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
      
    case 'SKIP_CURRENT_WORD': {
      // Use the preloaded word if available
      if (state.nextWord) {
        const definition = state.nextWord.definition || '';
        const definitionWords = splitDefinitionIntoWords(definition);
        
        return {
          ...state,
          words: [state.nextWord],
          definitionWords,
          nextWord: null,
          score: 0,
          errors: 0,
          time: 0,
          input: '',
          currentWordIndex: 0,
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
          input: '',
          currentWordIndex: 0,
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
        const definition = state.nextWord.definition || '';
        const definitionWords = splitDefinitionIntoWords(definition);
        
        return {
          ...state,
          words: [state.nextWord],
          definitionWords,
          nextWord: null,
          score: 0,
          errors: 0,
          time: 0,
          input: '',
          currentWordIndex: 0,
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
          input: '',
          currentWordIndex: 0,
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