// src/components/Character.tsx
import React, { memo } from 'react';
import { CharacterStatus } from '../types';

interface CharacterProps {
  character: string;
  status: CharacterStatus | string;
}

const Character: React.FC<CharacterProps> = memo(({ character, status }) => {
  const isSpace = character === ' ';
  
  // Define tailwind classes based on character status
  let statusClasses = '';
  
  switch(status) {
    case 'correct':
      statusClasses = 'text-accent-primary';
      break;
    case 'incorrect':
      statusClasses = 'text-error line-through decoration-error decoration-2';
      break;
    case 'untouched':
      statusClasses = 'text-text-secondary';
      break;
    case 'overflow':
      statusClasses = 'text-error line-through decoration-error';
      break;
    default:
      statusClasses = 'text-text-primary';
  }
  
  // Add space-specific styling
  const spaceClasses = isSpace ? 'min-w-[0.3em]' : 'min-w-[0.6em]';
  
  return (
    <span className={`relative inline-block text-center leading-none p-0 m-0 ${spaceClasses} ${statusClasses}`}>
      {character}
    </span>
  );
});

Character.displayName = 'Character';

export default Character;