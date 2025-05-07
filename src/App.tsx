// src/App.tsx
import React from 'react';
import { GameProvider, useGame } from './context/GameContext';
import Header from './components/Header';
import Test from './components/Test';
import Footer from './components/Footer';
import ErrorBoundary from './components/ErrorBoundary';
import UserInput from './components/UserInput';
import './App.css';

const GameContent: React.FC = () => {
  const { state } = useGame();

  if (state.status === 'loading') {
    return <div className="loading">Loading word and definition...</div>;
  }
  
  if (state.status === 'error') {
    return <div className="error">Error: {state.error}</div>;
  }

  return (
    <div className="content-area">
      <Test />
      <UserInput />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
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