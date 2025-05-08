// src/utils/wordGenerator.ts
import { WordObj } from '../types';
import { APP_CONFIG } from '../config/app.config';

// Track last word to avoid duplicates
let lastGeneratedWord = '';

interface Definition {
  definition: string;
  synonyms: string[];
  antonyms: string[];
  example?: string;
}

interface Meaning {
  partOfSpeech: string;
  definitions: Definition[];
}

interface DictionaryResponse {
  word: string;
  meanings: Meaning[];
}

class WordGenerator {
  async generate(): Promise<WordObj[]> {
    let retryCount = 0;
    const { API } = APP_CONFIG;
    
    while (retryCount < API.MAX_RETRIES) {
      try {
        // Get random word
        const wordRes = await fetch(API.WORD_API);
        if (!wordRes.ok) throw new Error('Failed to fetch word');
        
        const [word] = await wordRes.json() as string[];
        
        if (!word) throw new Error('Invalid word response');
        
        // Skip duplicates
        if (word === lastGeneratedWord) {
          throw new Error('Duplicate word');
        }

        // Get definition with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), API.TIMEOUT);
        
        const defRes = await fetch(`${API.DEFINITION_API}${word}`, {
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
        const delay = API.RETRY_DELAY * Math.pow(1.5, retryCount);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw new Error('Failed to load word. Try reloading the page.');
  }

  normalize(str: string): string {
    return str
      .split(';')[0]       // Take only the part before the first semicolon
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '') // Remove special characters
      .replace(/\s+/g, ' ')  // Normalize spaces
      .trim();
  }
}

export default new WordGenerator();