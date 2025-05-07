// src/utils/wordGenerator.ts
import { WordObj } from '../types';

interface APIConfig {
  WORD_API: string;
  DEFINITION_API: string;
  TIMEOUT: number;
  MAX_RETRIES: number;
  RETRY_DELAY: number;
}

const API_CONFIG: APIConfig = {
  WORD_API: 'https://random-word-api.herokuapp.com/word',
  DEFINITION_API: 'https://api.dictionaryapi.dev/api/v2/entries/en/',
  TIMEOUT: 5000,
  MAX_RETRIES: 5,
  RETRY_DELAY: 500,
};

// Track last word to avoid duplicates
let lastGeneratedWord = '';

interface DictionaryResponse {
  word: string;
  meanings: Array<{
    partOfSpeech: string;
    definitions: Array<{
      definition: string;
      synonyms: string[];
      antonyms: string[];
      example?: string;
    }>;
  }>;
}

export default {
  async generate(): Promise<WordObj[]> {
    let retryCount = 0;
    
    while (retryCount < API_CONFIG.MAX_RETRIES) {
      try {
        // Get random word
        const wordRes = await fetch(API_CONFIG.WORD_API);
        const [word] = await wordRes.json() as string[];
        
        if (!word) throw new Error('Invalid word response');
        
        // Skip duplicates
        if (word === lastGeneratedWord) {
          throw new Error('Duplicate word');
        }

        // Get definition with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);
        
        const defRes = await fetch(`${API_CONFIG.DEFINITION_API}${word}`, {
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (!defRes.ok) throw new Error('Definition not found');
        
        const data = await defRes.json() as DictionaryResponse[];
        const definition = data[0]?.meanings[0]?.definitions[0]?.definition;
        
        if (!definition) throw new Error('Missing definition');
        
        // Save current word to prevent duplication
        lastGeneratedWord = word;
        
        return [{
          word,
          definition: this.normalize(definition),
        }];
      } catch (error) {
        retryCount++;
        
        // Wait before retrying with exponential backoff
        await new Promise(resolve => 
          setTimeout(resolve, API_CONFIG.RETRY_DELAY * Math.pow(1.5, retryCount))
        );
      }
    }
    
    throw new Error('Failed to load word. Try reloading the page.');
  },

  normalize(str: string): string {
    return str
      .split(';')[0]  // Take only the part before the first semicolon
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '') // Remove special characters
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim();
  }
};