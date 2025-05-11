// src/contexts/GameContext.tsx
import React, { createContext, useContext } from 'react';
import type {
  GameState,
  ThreadState,
  GlobalConcurrencyLocks,
  MetaKnowledge,
  UpgradeCosts,
} from '../types/gameState'; 

// Define the context type
// This will include gameState, setGameState (for direct mutation if needed, or specific setters),
// and all the action handlers from useGameState and Game.tsx
export interface GameContextType {
  gameState: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>; // For more complex/direct updates if needed
  
  // Toasts
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;

  // Core Actions from Game.tsx (originally from useGameState or direct)
  produceTickManually: () => void;
  toggleAutoTick: () => void;
  buyUpgrade: (upgradeKey: keyof UpgradeCosts, costOnClick: number) => void;
  runCode: (codeFromLayer: string, layer: string, threadId?: number) => { success: boolean; ticksGenerated: number };
  runUnitTests: (layer: string) => void;
  garbageCollect: () => void;
  calculateMkGain: () => number;
  handlePrestige: () => { success: boolean; mkGained: number }; // Modified return type
  spendMetaKnowledge: (buffKey: keyof MetaKnowledge['buffs']) => void;

  // Layer-specific state handlers from useGameState
  handleAssemblyCodeChange: (newCode: string) => void;
  handleAssemblyOutputSet: (newOutput: string) => void;
  handleHighLevelCodeChange: (newCode: string) => void;
  handleHighLevelOutputSet: (newOutput: string) => void;
  handleConcurrencyThreadsChange: (updater: (prevThreads: ThreadState[]) => ThreadState[]) => void;
  handleConcurrencyGlobalLocksChange: (updater: (prevLocks: GlobalConcurrencyLocks) => GlobalConcurrencyLocks) => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider: React.FC<{ children: React.ReactNode; value: GameContextType }> = ({ children, value }) => {
  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};

export const useGameContext = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGameContext must be used within a GameProvider');
  }
  return context;
};