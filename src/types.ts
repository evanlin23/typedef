// src/types.ts
export interface WordObj {
  word: string;
  definition: string;
}

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

export interface Word {
  text: string;
  status: 'active' | 'completed' | 'upcoming';
  characters: CharacterStatus[];
}

export type CharacterStatus = 'untouched' | 'correct' | 'incorrect' | 'overflow';

export interface GameState {
  status: 'loading' | 'ready' | 'error';
  words: WordObj[];
  nextWord: WordObj | null;
  isLoadingNext: boolean;
  input: string;
  currentWordIndex: number;
  definitionWords: Word[];
  time: number;
  score: number;
  errors: number;
  testHistory: TestResult[];
  testCompleted: boolean;
  timerActive: boolean;
  startTime: number | null;
  currentTestStats: TestResult | null;
  error?: string;
}

export type GameAction =
  | { type: 'SET_STATUS'; payload: GameState['status'] }
  | { type: 'SET_WORDS'; payload: WordObj[] }
  | { type: 'SET_NEXT_WORD'; payload: WordObj }
  | { type: 'SET_LOADING_NEXT'; payload: boolean }
  | { type: 'SET_INPUT'; payload: string }
  | { type: 'INCREMENT_TIME' }
  | { type: 'INCREMENT_SCORE' }
  | { type: 'INCREMENT_ERRORS' }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'COMPLETE_TEST' }
  | { type: 'SKIP_CURRENT_WORD' }
  | { type: 'START_NEW_TEST' }
  | { type: 'MOVE_TO_NEXT_WORD' };

export interface GameContextType {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}