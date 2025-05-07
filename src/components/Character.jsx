// src/components/Character.jsx
import React, { memo } from 'react';

const Character = memo(({ character, input, wordIndex, charIndex }) => {
  let state = 'untouched';
  
  if (input.length > charIndex) {
    state = input[charIndex] === character ? 'correct' : 'incorrect';
  }

  return <span className={`char ${state}`}>{character}</span>;
});

export default Character;