// src/components/Character.tsx
import React, { memo } from 'react';

interface CharacterProps {
  character: string;
  input: string[];
  charIndex: number;
}

const Character: React.FC<CharacterProps> = memo(({ character, input, charIndex }) => {
  let state: 'untouched' | 'correct' | 'incorrect' = 'untouched';
  
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