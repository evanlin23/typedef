// src/components/GameTabs.tsx
import React from 'react'; 

import MachineLayer from './layers/MachineLayer';
import AssemblyLayer from './layers/AssemblyLayer';
import HighLevelLayer from './layers/HighLevelLayer';
import ConcurrencyLayer from './layers/ConcurrencyLayer';
import AILayer from './layers/AILayer';
import PrestigePanel from './PrestigePanel';

// ** Props are significantly reduced as most come from context **
interface GameTabsProps {
  activeTabState: string;
  setActiveTabState: (tab: string) => void;
}

const GameTabs: React.FC<GameTabsProps> = ({
  activeTabState,
  setActiveTabState,
}) => {
  // ** Components no longer need gameState or actions passed as props here **
  // ** They will consume them from GameContext directly **
  const tabs = [
    { key: 'machine', label: 'Machine Core', component: <MachineLayer /> },
    { key: 'assembly', label: 'Assembly', component: <AssemblyLayer /> },
    { key: 'highLevel', label: 'High-Level', component: <HighLevelLayer /> },
    { key: 'concurrency', label: 'Concurrency', component: <ConcurrencyLayer /> },
    { key: 'ai', label: 'AI Subsystem', component: <AILayer /> },
    { key: 'prestige', label: 'Prestige', component: <PrestigePanel /> },
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