// src/components/Header.tsx
import React, { memo } from 'react';

const Header: React.FC = memo(() => {
  return (
    <header className="header">
      <h1>
        <span style={{ color: '#28a745' }}>type</span>
        <span style={{ color: '#e0e0e0' }}>def</span>
      </h1>
    </header>
  );
});

Header.displayName = 'Header';

export default Header;