// src/components/Game.tsx
import { useCallback, useMemo, useState } from 'react';
import ResourcePanel from './ResourcePanel';
import UpgradePanel from './UpgradePanel';
import GameTabs from './GameTabs';
import ToastSystem from './ToastSystem';

import { useGameState } from '../hooks/useGameState';
import { useGameLoop } from '../hooks/useGameLoop';
import { GameProvider } from '../contexts/GameContext'; 

import * as ResourceActions from '../features/resources/ResourceActions';
import * as UpgradeActions from '../features/upgrades/UpgradeActions';
import * as CodeActions from '../features/code/CodeExecution';
import * as PrestigeActions from '../features/prestige/PrestigeActions';
import { calculateMkGain as calculateMkGainUtil } from '../utils/gameCalculations';

import type { GameState } from '../types/gameState';

const Game = () => {
  const {
    gameState,
    setGameState,
    toasts,
    addToast,
    // ** Layer-specific handlers for context **
    handleAssemblyCodeChange,
    handleAssemblyOutputSet,
    handleHighLevelCodeChange,
    handleHighLevelOutputSet,
    handleConcurrencyThreadsChange,
    handleConcurrencyGlobalLocksChange,
    toggleAutoTick,
  } = useGameState();

  useGameLoop({ gameState, setGameState, addToast });

  const [activeTab, setActiveTab] = useState('machine');

  // ** Define actions to be passed to context **
  const produceTickManually = useCallback(() => {
    ResourceActions.produceTickManually(setGameState);
  }, [setGameState]);

  const buyUpgrade = useCallback((upgradeKey: keyof GameState['upgradeCosts'], costOnClick: number) => {
    UpgradeActions.buyUpgrade(setGameState, addToast, upgradeKey, costOnClick);
  }, [setGameState, addToast]);

  const runCode = useCallback((codeFromLayer: string, layer: string, threadId?: number) => {
    return CodeActions.runCode(gameState, setGameState, codeFromLayer, layer, threadId);
  }, [gameState, setGameState]);

  const runUnitTests = useCallback((layer: string) => {
    CodeActions.runUnitTests(gameState, setGameState, addToast, layer);
  }, [gameState, setGameState, addToast]);

  const garbageCollect = useCallback(() => {
    ResourceActions.garbageCollect(gameState, setGameState, addToast);
  }, [gameState, setGameState, addToast]);

  const calculateMkGain = useCallback((): number => {
    return calculateMkGainUtil(gameState);
  }, [gameState]);

  // ** Modified handlePrestige to set tab locally after action **
  const handlePrestigeAction = useCallback(() => {
    // ** PrestigeActions.handlePrestige now returns a status **
    const result = PrestigeActions.handlePrestige(gameState, setGameState, addToast);
    if (result.success) {
      setActiveTab('machine'); // ** Set active tab here **
    }
    return result;
  }, [gameState, setGameState, addToast, setActiveTab]);


  const spendMetaKnowledge = useCallback((buffKey: keyof GameState['metaKnowledge']['buffs']) => {
    PrestigeActions.spendMetaKnowledge(setGameState, addToast, buffKey);
  }, [setGameState, addToast]);
  
  const garbageCollectionCost = useMemo(() => 
    Math.floor(10 * gameState.metaKnowledge.buffs.costMultiplier),
    [gameState.metaKnowledge.buffs.costMultiplier]
  );

  // ** Prepare context value **
  const gameContextValue = {
    gameState,
    setGameState, // Provide setGameState directly for flexibility
    addToast,
    produceTickManually,
    toggleAutoTick, // Now from useGameState, passed to context
    buyUpgrade,
    runCode,
    runUnitTests,
    garbageCollect,
    calculateMkGain,
    handlePrestige: handlePrestigeAction, // Pass the action wrapper
    spendMetaKnowledge,
    handleAssemblyCodeChange,
    handleAssemblyOutputSet,
    handleHighLevelCodeChange,
    handleHighLevelOutputSet,
    handleConcurrencyThreadsChange,
    handleConcurrencyGlobalLocksChange,
  };

  return (
    // ** Wrap with GameProvider **
    <GameProvider value={gameContextValue}>
      <ToastSystem toasts={toasts} />

      <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">
        <div className="lg:w-1/3 xl:w-1/4 flex flex-col space-y-4 sm:space-y-6">
          {/* ResourcePanel and UpgradePanel will now use context */}
          <ResourcePanel />
          <UpgradePanel />
          <button
            onClick={garbageCollect} // This garbageCollect is the one defined above, passed to context
            disabled={gameState.resources.ticks < garbageCollectionCost}
            title={gameState.resources.ticks < garbageCollectionCost ? `Not enough Ticks (Need ${garbageCollectionCost})` : `Cost: ${garbageCollectionCost} Ticks`}
            className="w-full px-4 py-3 rounded font-semibold bg-yellow-500 hover:bg-yellow-600 text-black disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150"
          >
            Garbage Collection (Cost: {garbageCollectionCost})
          </button>
        </div>
        
        <GameTabs
            // ** Pass only activeTab and its setter; other state/actions come from context **
            activeTabState={activeTab}
            setActiveTabState={setActiveTab}
        />
      </div>
    </GameProvider>
  );
};

export default Game;