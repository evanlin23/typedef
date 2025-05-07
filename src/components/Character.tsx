// src/components/Character.tsx
import React, { memo } from 'react';

interface CharacterProps {
  character: string;
  status: 'untouched' | 'correct' | 'incorrect' | 'overflow';
}

const Character: React.FC<CharacterProps> = memo(({ character, status }) => {
  const isSpace = character === ' ';

  return (
    <span className={`char ${status}${isSpace ? ' space' : ''}`}>
      {character}
    </span>
  );
});

export default Character;