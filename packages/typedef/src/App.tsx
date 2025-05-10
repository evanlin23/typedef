// src/App.tsx
import React, { memo } from 'react';
import { GameProvider, useGame } from './context/GameContext';
import Header from './components/Header';
import Test from './components/Test';
import Footer from './components/Footer';
import ErrorBoundary from './components/ErrorBoundary';
import UserInput from './components/UserInput';

const GameContent: React.FC = memo(() => {
  const { state } = useGame();

  if (state.status === 'loading') {
    return <div className="text-center py-8 text-lg text-text-secondary">Loading word and definition...</div>;
  }
  
  if (state.status === 'error') {
    return <div className="p-4 bg-red-100 text-red-700 rounded-lg text-center my-5">
      Error: {state.error || 'Unknown error occurred'}
    </div>;
  }

  return (
    <div className="w-full">
      <Test />
      <UserInput />
    </div>
  );
});

GameContent.displayName = 'GameContent';

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <GameProvider>
      <div className="relative w-screen h-screen font-mono text-text-primary bg-bg-primary overflow-hidden">
        <div className="fixed top-10 left-1/2 transform -translate-x-1/2 p-4 z-10">
          <Header />
        </div>
        <div className="flex items-center justify-center h-full">
          <GameContent />
        </div>
        <div className="fixed bottom-10 left-1/2 transform -translate-x-1/2 p-4 z-10">
          <Footer />
        </div>
      </div>

      </GameProvider>
    </ErrorBoundary>
  );
};

export default App;