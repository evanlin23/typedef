// src/components/Character.jsx
import React, { memo } from 'react';

const Character = memo(({ character, input, wordIndex, charIndex }) => {
  let state = 'untouched';
  
  // Simply check if the character at this index in the input array matches
  if (input.length > charIndex) {
    state = input[charIndex] === character ? 'correct' : 'incorrect';
  }
  
  return <span className={`char ${state}`}>{character}</span>;
});

export default Character;