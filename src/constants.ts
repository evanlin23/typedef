export const MAX_OVERFLOW_CHARS = 19;
// export const CORRECT = '#28a745';
export const API = {
  WORD_API: 'https://random-word-api.herokuapp.com/word',
  DEFINITION_API: 'https://api.dictionaryapi.dev/api/v2/entries/en/',
  TIMEOUT: 5000,
  MAX_RETRIES: 5,
  RETRY_DELAY: 500,
} as const;

export const KEYBOARD_SHORTCUTS = {
  SKIP_WORD: ['Tab', 'Enter'],
  NEXT_TEST: ['Enter'],
} as const;