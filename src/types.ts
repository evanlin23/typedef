// src/types.ts

// Status types
export type GameStatus = 'loading' | 'ready' | 'error';
export type WordStatus = 'active' | 'completed' | 'upcoming';
export type CharacterStatus = 'untouched' | 'correct' | 'incorrect' | 'overflow';

// Core data structure for a word from the API
export interface WordObj {
  word: string;
  definition: string;
}

// Represents a word in the definition that will be typed
export interface Word {
  text: string;
  status: WordStatus;
  characters: CharacterStatus[];
  overflow: string;
}

// Test result statistics
export interface TestResult {
  word: string;
  definition: string;
  time: number;
  accuracy: number;
  wpm: number;
  errors: number;
  correct: number;
  timestamp: string;
}

// Game State
export interface GameState {
  // Status
  status: GameStatus;
  error: string | null;
  testCompleted: boolean;
  
  // Words and typing
  words: WordObj[];
  nextWord: WordObj | null;
  isLoadingNext: boolean;
  input: string;
  currentWordIndex: number;
  definitionWords: Word[];
  
  // Statistics
  time: number;
  score: number;
  errors: number;
  testHistory: TestResult[];
  currentTestStats: TestResult | null;
  
  // Timer
  timerActive: boolean;
  startTime: number | null;
}

// Redux-style actions
export type GameAction =
  | { type: 'SET_STATUS'; payload: GameStatus }
  | { type: 'SET_WORDS'; payload: WordObj[] }
  | { type: 'SET_NEXT_WORD'; payload: WordObj }
  | { type: 'SET_LOADING_NEXT'; payload: boolean }
  | { type: 'SET_INPUT'; payload: string }
  | { type: 'MOVE_TO_NEXT_WORD' }
  | { type: 'INCREMENT_TIME' }
  | { type: 'INCREMENT_SCORE' }
  | { type: 'INCREMENT_ERRORS' }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'COMPLETE_TEST' }
  | { type: 'SKIP_CURRENT_WORD' }
  | { type: 'START_NEW_TEST' };

// Context type
export interface GameContextType {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}