// src/components/Game.tsx
import React, { useCallback, useMemo, useState } from 'react'; // Added useState for activeTab
import ResourcePanel from './ResourcePanel';
import UpgradePanel from './UpgradePanel';

import { useGameState } from '../hooks/useGameState';
import { useGameLoop } from '../hooks/useGameLoop';
import { calculateMkGain as calculateMkGainUtil } from '../utils/gameCalculations';
import ToastSystem from './ToastSystem';
import GameTabs from './GameTabs';

import * as ResourceActions from '../features/resources/ResourceActions';
import * as UpgradeActions from '../features/upgrades/UpgradeActions';
import * as CodeActions from '../features/code/CodeExecution';
import * as PrestigeActions from '../features/prestige/PrestigeActions';

import type { GameState } from '../types/gameState'; // For type hint on upgradeKey

const Game = () => {
  const {
    gameState,
    setGameState,
    toasts,
    addToast,
    handleAssemblyCodeChange,
    handleAssemblyOutputSet,
    handleHighLevelCodeChange,
    handleHighLevelOutputSet,
    handleConcurrencyThreadsChange,
    handleConcurrencyGlobalLocksChange,
    toggleAutoTick,
  } = useGameState();

  useGameLoop({ gameState, setGameState, addToast });

  const [activeTab, setActiveTab] = useState('machine'); // Active tab state managed here

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

  const handlePrestige = useCallback(() => {
    // setActiveTab is passed directly to be called within handlePrestige action
    PrestigeActions.handlePrestige(gameState, setGameState, addToast, setActiveTab);
  }, [gameState, setGameState, addToast, setActiveTab]);

  const spendMetaKnowledge = useCallback((buffKey: keyof GameState['metaKnowledge']['buffs']) => {
    PrestigeActions.spendMetaKnowledge(setGameState, addToast, buffKey);
  }, [setGameState, addToast]);
  
  const garbageCollectionCost = useMemo(() => 
    Math.floor(10 * gameState.metaKnowledge.buffs.costMultiplier),
    [gameState.metaKnowledge.buffs.costMultiplier]
  );

  return (
    <>
      <ToastSystem toasts={toasts} />

      <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">
        <div className="lg:w-1/3 xl:w-1/4 flex flex-col space-y-4 sm:space-y-6">
          <ResourcePanel gameState={gameState} />
          <UpgradePanel gameState={gameState} buyUpgrade={buyUpgrade} />
          <button
            onClick={garbageCollect}
            disabled={gameState.resources.ticks < garbageCollectionCost}
            title={gameState.resources.ticks < garbageCollectionCost ? `Not enough Ticks (Need ${garbageCollectionCost})` : `Cost: ${garbageCollectionCost} Ticks`}
            className="w-full px-4 py-3 rounded font-semibold bg-yellow-500 hover:bg-yellow-600 text-black disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150"
          >
            Garbage Collection (Cost: {garbageCollectionCost})
          </button>
        </div>
        
        <GameTabs
            gameState={gameState}
            activeTabState={activeTab} // Pass activeTab state
            setActiveTabState={setActiveTab} // Pass setter for activeTab
            handleAssemblyCodeChange={handleAssemblyCodeChange}
            handleAssemblyOutputSet={handleAssemblyOutputSet}
            handleHighLevelCodeChange={handleHighLevelCodeChange}
            handleHighLevelOutputSet={handleHighLevelOutputSet}
            handleConcurrencyThreadsChange={handleConcurrencyThreadsChange}
            handleConcurrencyGlobalLocksChange={handleConcurrencyGlobalLocksChange}
            toggleAutoTick={toggleAutoTick}
            produceTickManually={produceTickManually}
            runCode={runCode}
            runUnitTests={runUnitTests}
            handlePrestige={handlePrestige}
            spendMetaKnowledge={spendMetaKnowledge}
            calculateMkGain={calculateMkGain}
        />
      </div>
    </>
  );
};

export default Game;