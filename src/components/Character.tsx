// src/components/Character.tsx
import React, { memo } from 'react';
import { CharacterStatus } from '../types';

interface CharacterProps {
  character: string;
  status: CharacterStatus | string;
}

const Character: React.FC<CharacterProps> = memo(({ character, status }) => {
  const isSpace = character === ' ';
  const cssClass = `char ${status}${isSpace ? ' space' : ''}`;

  return (
    <span className={cssClass}>
      {character}
    </span>
  );
});

Character.displayName = 'Character';

export default Character;