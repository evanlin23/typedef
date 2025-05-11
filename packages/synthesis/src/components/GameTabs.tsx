// src/components/GameTabs.tsx
import React, { useState, useEffect } from 'react'; // Added useEffect
import type { GameState, ThreadState, GlobalConcurrencyLocks, MetaKnowledge } from '../types/gameState';
import MachineLayer from './layers/MachineLayer';
import AssemblyLayer from './layers/AssemblyLayer';
import HighLevelLayer from './layers/HighLevelLayer';
import ConcurrencyLayer from './layers/ConcurrencyLayer';
import AILayer from './layers/AILayer';
import PrestigePanel from './PrestigePanel';

interface GameTabsProps {
  gameState: GameState;
  activeTabState: string; // Receive activeTab from parent
  setActiveTabState: (tab: string) => void; // Parent's setter for activeTab

  handleAssemblyCodeChange: (newCode: string) => void;
  handleAssemblyOutputSet: (newOutput: string) => void;
  handleHighLevelCodeChange: (newCode: string) => void;
  handleHighLevelOutputSet: (newOutput: string) => void;
  handleConcurrencyThreadsChange: (updater: (prevThreads: ThreadState[]) => ThreadState[]) => void;
  handleConcurrencyGlobalLocksChange: (updater: (prevLocks: GlobalConcurrencyLocks) => GlobalConcurrencyLocks) => void;
  toggleAutoTick: () => void;
  produceTickManually: () => void;
  runCode: (codeFromLayer: string, layer: string, threadId?: number) => { success: boolean; ticksGenerated: number };
  runUnitTests: (layer: string) => void;
  handlePrestige: () => void;
  spendMetaKnowledge: (buffKey: keyof MetaKnowledge['buffs']) => void;
  calculateMkGain: () => number;
}

const GameTabs: React.FC<GameTabsProps> = ({
  gameState,
  activeTabState, // Use from props
  setActiveTabState, // Use from props
  handleAssemblyCodeChange, handleAssemblyOutputSet,
  handleHighLevelCodeChange, handleHighLevelOutputSet,
  handleConcurrencyThreadsChange, handleConcurrencyGlobalLocksChange,
  toggleAutoTick,
  produceTickManually,
  runCode, runUnitTests,
  handlePrestige, spendMetaKnowledge, calculateMkGain,
}) => {

  const tabs = [
    { key: 'machine', label: 'Machine Core', component: <MachineLayer gameState={gameState} produceTickManually={produceTickManually} toggleAutoTick={toggleAutoTick} /> },
    { key: 'assembly', label: 'Assembly', component: <AssemblyLayer gameState={gameState} runCode={(code) => runCode(code, 'assembly')} runUnitTests={() => runUnitTests('assembly')} onCodeChange={handleAssemblyCodeChange} onOutputSet={handleAssemblyOutputSet}/> },
    { key: 'highLevel', label: 'High-Level', component: <HighLevelLayer gameState={gameState} runCode={(code) => runCode(code, 'highLevel')} runUnitTests={() => runUnitTests('highLevel')} onCodeChange={handleHighLevelCodeChange} onOutputSet={handleHighLevelOutputSet}/> },
    { key: 'concurrency', label: 'Concurrency', component: <ConcurrencyLayer gameState={gameState} runCode={runCode} onThreadsChange={handleConcurrencyThreadsChange} onGlobalLocksChange={handleConcurrencyGlobalLocksChange} /> },
    { key: 'ai', label: 'AI Subsystem', component: <AILayer gameState={gameState} /> },
    { key: 'prestige', label: 'Prestige', component: <PrestigePanel gameState={gameState} onPrestige={handlePrestige} onSpendMetaKnowledge={spendMetaKnowledge} calculateMkGain={calculateMkGain} /> },
  ];
  
  return (
    <div className="lg:w-2/3 xl:w-3/4 bg-background-secondary rounded-md border border-border-primary shadow-lg p-4 sm:p-6 min-h-[calc(100vh-250px)] sm:min-h-[calc(100vh-200px)]">
      <div className="flex flex-wrap border-b border-border-secondary mb-4 sm:mb-6 -mx-2 sm:-mx-4">
        {tabs.map((tabInfo) => (
          <button 
            key={tabInfo.key}
            onClick={() => setActiveTabState(tabInfo.key)}
            className={`px-3 sm:px-4 py-2 text-sm sm:text-base transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-opacity-50 ${
              activeTabState === tabInfo.key 
                ? 'text-accent-primary border-b-2 border-accent-primary font-semibold focus:ring-accent-primary' 
                : 'text-text-secondary hover:text-text-primary focus:ring-accent-secondary'
            }`}
            aria-current={activeTabState === tabInfo.key ? "page" : undefined}
          >
            {tabInfo.label}
          </button>
        ))}
      </div>
      {tabs.find(tabInfo => tabInfo.key === activeTabState)?.component}
    </div>
  );
};

export default GameTabs;