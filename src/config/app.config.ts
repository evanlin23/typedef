// src/config/app.config.ts
export const APP_CONFIG = {
  // Game settings
  MAX_OVERFLOW_CHARS: 19,
  
  // Styling
  THEME: {
    BG_MAIN: '#121212',
    BG_SECONDARY: '#1e1e1e',
    TEXT_PRIMARY: '#e0e0e0',
    TEXT_SECONDARY: '#aaaaaa',
    BORDER_COLOR: '#2a2a2a',
    HIGHLIGHT_BG: '#1a1a1a',
    SHADOW: 'rgba(0, 0, 0, 0.5)',
    CORRECT: '#28a745',
    INCORRECT: '#dc3545',
    LINK_COLOR: '#58a6ff',
  },
  
  // Animation
  ANIMATION: {
    CURSOR_FLASH_DURATION: '1.2s',
    FADE_IN_DURATION: '0.5s',
  },
  
  // Keyboard shortcuts
  KEYS: {
    SKIP_WORD: ['Tab', 'Enter'],
    NEXT_TEST: ['Enter'],
  },
  
  // API Configuration
  API: {
    WORD_API: 'https://random-word-api.herokuapp.com/word',
    DEFINITION_API: 'https://api.dictionaryapi.dev/api/v2/entries/en/',
    TIMEOUT: 5000,
    MAX_RETRIES: 5,
    RETRY_DELAY: 500,
  },
};

// Define types for various statuses
export type GameStatus = 'loading' | 'ready' | 'error';
export type WordStatus = 'active' | 'completed' | 'upcoming';
export type CharacterStatus = 'untouched' | 'correct' | 'incorrect' | 'overflow';