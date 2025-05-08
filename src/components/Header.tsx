// src/components/Header.tsx
import React, { memo } from 'react';
import { CORRECT } from '../constants';

const Header: React.FC = memo(() => {
  return (
    <header className="text-center mb-8">
      <h1 className="text-4xl font-bold">
        <span className="text-green-400">type</span>
        <span>def</span>
      </h1>
    </header>
  );
});

Header.displayName = 'Header';

export default Header;