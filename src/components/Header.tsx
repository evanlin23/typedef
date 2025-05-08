// src/components/Header.tsx
import React, { memo } from 'react';
import { APP_CONFIG } from '../config/app.config';

const Header: React.FC = memo(() => {
  return (
    <header className="header">
      <h1>
        <span style={{ color: APP_CONFIG.THEME.CORRECT }}>type</span>
        <span style={{ color: APP_CONFIG.THEME.TEXT_PRIMARY }}>def</span>
      </h1>
    </header>
  );
});

Header.displayName = 'Header';

export default Header;