// src/config/app.config.ts

// Define types for various statuses
export type GameStatus = 'loading' | 'ready' | 'error';
export type WordStatus = 'active' | 'completed' | 'upcoming';
export type CharacterStatus = 'untouched' | 'correct' | 'incorrect' | 'overflow';

export const APP_CONFIG = {
  // Game settings
  MAX_OVERFLOW_CHARS: 19,
  
  // App-wide configuration
  FONTS: {
    PRIMARY: 'Courier New, monospace',
  },
  
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
    
    // Header specific colors
    HEADER: {
      GREEN: '#28a745',
      WHITE: '#e0e0e0',
    },
    
    // Error-specific colors
    ERROR: {
      BG: '#5c2b2e',
      TEXT: '#f8d7da',
    },
    
    // KBD styling
    KBD: {
      BG: '#333',
      BORDER: '#555',
      TEXT: '#eee',
    },
  },
  
  // Layout
  LAYOUT: {
    DEFINITION_WIDTH: '70vw',
    RESULTS_WIDTH: '60%',
    BORDER_RADIUS: '8px',
    DEFAULT_PADDING: '20px',
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

// Function to inject theme variables into CSS
export function injectThemeVariables(): void {
  const root = document.documentElement;
  
  // Inject all theme variables
  Object.entries(APP_CONFIG.THEME).forEach(([key, value]) => {
    if (typeof value === 'string') {
      root.style.setProperty(`--theme-${key.toLowerCase().replace(/_/g, '-')}`, value);
    } else if (typeof value === 'object') {
      // Handle nested objects like HEADER
      Object.entries(value).forEach(([subKey, subValue]) => {
        if (typeof subValue === 'string') {
          root.style.setProperty(
            `--theme-${key.toLowerCase()}-${subKey.toLowerCase().replace(/_/g, '-')}`, 
            subValue
          );
        }
      });
    }
  });
  
  // Inject animation durations
  Object.entries(APP_CONFIG.ANIMATION).forEach(([key, value]) => {
    root.style.setProperty(`--animation-${key.toLowerCase().replace(/_/g, '-')}`, value);
  });
  
  // Inject layout variables
  Object.entries(APP_CONFIG.LAYOUT).forEach(([key, value]) => {
    root.style.setProperty(`--layout-${key.toLowerCase().replace(/_/g, '-')}`, value);
  });
}