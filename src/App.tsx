// src/App.tsx
import React, { memo, useEffect } from 'react';
import { GameProvider, useGame } from './context/GameContext';
import Header from './components/Header';
import Test from './components/Test';
import Footer from './components/Footer';
import ErrorBoundary from './components/ErrorBoundary';
import UserInput from './components/UserInput';
import { injectThemeVariables } from './config/app.config';
import './App.css';

// Initialize theme variables
const ThemeInitializer = () => {
  useEffect(() => {
    injectThemeVariables();
  }, []);
  
  return null;
};

const GameContent: React.FC = memo(() => {
  const { state } = useGame();

  if (state.status === 'loading') {
    return <div className="loading">Loading word and definition...</div>;
  }
  
  if (state.status === 'error') {
    return <div className="error">Error: {state.error || 'Unknown error occurred'}</div>;
  }

  return (
    <div className="content-area">
      <Test />
      <UserInput />
    </div>
  );
});

GameContent.displayName = 'GameContent';

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <ThemeInitializer />
      <GameProvider>
        <div className="container">
          <Header />
          <GameContent />
          <Footer />
        </div>
      </GameProvider>
    </ErrorBoundary>
  );
};

export default App;