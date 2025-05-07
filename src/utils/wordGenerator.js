// src/utils/wordGenerator.js
const API_CONFIG = {
  WORD_API: 'https://random-word-api.herokuapp.com/word',
  DEFINITION_API: 'https://api.dictionaryapi.dev/api/v2/entries/en/',
};

// Keep a record of the last word to avoid duplicates
let lastGeneratedWord = '';

export default {
  async generate() {
    const maxRetries = 5;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
      try {
        // Get random word
        const wordRes = await fetch(API_CONFIG.WORD_API);
        const [word] = await wordRes.json();
        
        if (!word) throw new Error('Invalid word response');
        
        // Skip if it's the same as the last word
        if (word === lastGeneratedWord) {
          // console.log("Skipping duplicate word:", word);
          throw new Error('Duplicate word');
        }

        // Get definition with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const defRes = await fetch(`${API_CONFIG.DEFINITION_API}${word}`, {
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (!defRes.ok) throw new Error('Definition not found');
        
        const data = await defRes.json();
        const definition = data[0]?.meanings[0]?.definitions[0]?.definition;
        
        if (!definition) throw new Error('Missing definition');
        
        // Save this word to avoid duplication
        lastGeneratedWord = word;
        
        const result = [{
          word,
          definition: this.normalize(definition),
        }];
        
        // console.log("Generated new word:", result);
        return result;

      } catch (error) {
        console.warn(`Attempt ${retryCount + 1} failed:`, error.message);
        retryCount++;
        
        // Exponential backoff
        await new Promise(resolve => 
          setTimeout(resolve, 500)
        );
      }
    }
    
    throw new Error('Maximum retries reached. Try reloading the page.');
  },

  normalize(str) {
    return str
      .split(';')[0]  // Take only the part before the first semicolon
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
};