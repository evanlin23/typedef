// src/components/Header.tsx
import React, { memo } from 'react';
import { APP_CONFIG } from '../config/app.config';

const Header: React.FC = memo(() => {
  // Using inline styles for the colors that come from config
  // We could define custom colors in the tailwind config if needed
  return (
    <header className="text-center mb-8">
      <h1 className="text-4xl font-bold">
        <span style={{ color: APP_CONFIG.THEME.CORRECT }}>type</span>
        <span style={{ color: APP_CONFIG.THEME.TEXT_PRIMARY }}>def</span>
      </h1>
    </header>
  );
});

Header.displayName = 'Header';

export default Header;