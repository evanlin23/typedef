// src/components/Header.tsx
import React, { memo } from 'react';

const Header: React.FC = memo(() => {
  return (
    <header className="text-center mb-8">
      <h1 className="text-4xl font-bold">
        <span className="text-accent-primary">type</span>
        <span>def</span>
      </h1>
    </header>
  );
});

Header.displayName = 'Header';

export default Header;