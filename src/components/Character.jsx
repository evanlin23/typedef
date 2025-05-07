// src/components/Character.jsx
import React, { memo } from 'react';

const Character = memo(({ character, input, charIndex }) => {
  let state = 'untouched';
  
  if (input.length > charIndex) {
    state = input[charIndex] === character ? 'correct' : 'incorrect';
  }

  const isSpace = character === ' ';

  return (
    <span className={`char ${state}${isSpace ? ' space' : ''}`}>
      {character}
    </span>
  );
});

export default Character;