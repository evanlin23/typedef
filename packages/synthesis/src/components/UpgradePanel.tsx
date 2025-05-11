// src/components/UpgradePanel.tsx
import type { UpgradeCosts, GameState } from '../types/gameState';
// Remove calculateActualMaxMemory from import, calculateMaxThreads is fine
import { calculateMaxThreads, calculateActualMaxMemoryValue } from '../types/gameState'; // Added calculateActualMaxMemoryValue for potential future use

interface UpgradePanelProps {
  gameState: GameState;
  buyUpgrade: (upgradeKey: keyof UpgradeCosts, costDisplayedOnClick: number) => void;
}

const UpgradePanel = ({ gameState, buyUpgrade }: UpgradePanelProps) => {
  const { upgrades, upgradeCosts, resources, metaKnowledge } = gameState;
  const actualCostMultiplier = metaKnowledge.buffs.costMultiplier;

  const upgradeItems = [
    { 
      key: 'cpu' as keyof UpgradeCosts, 
      name: 'CPU Core Clock', 
      level: upgrades.cpuLevel,
      description: `Current Level: ${upgrades.cpuLevel}. Boosts base tick generation from CPU.`
    },
    { 
      key: 'memory' as keyof UpgradeCosts, 
      name: 'Memory Capacity', 
      level: upgrades.memoryLevel,
      // Use resources.maxMemory to display current max memory
      description: `Current Level: ${upgrades.memoryLevel}. Max Memory: ${resources.maxMemory.toFixed(0)} CU.`
      // If you wanted to show *next level's* potential max memory:
      // description: `Current Level: ${upgrades.memoryLevel}. Max Memory: ${resources.maxMemory.toFixed(0)} CU. Next: ${calculateActualMaxMemoryValue(upgrades.memoryLevel + 1, metaKnowledge.buffs.memoryMultiplier).toFixed(0)} CU.`
    },
    { 
      key: 'optimization' as keyof UpgradeCosts, 
      name: 'System Optimization', 
      level: upgrades.optimizationLevel,
      description: `Current Level: ${upgrades.optimizationLevel}. Reduces passive entropy buildup.`
    },
    { 
      key: 'aiCore' as keyof UpgradeCosts, 
      name: 'AI Computation Cores', 
      level: upgrades.aiCoreLevel,
      description: `Current Level: ${upgrades.aiCoreLevel}. Enables passive AI tick generation.`
    },
    {
      key: 'maxThreads' as keyof UpgradeCosts,
      name: 'Thread Scheduler',
      level: upgrades.maxThreadsLevel,
      description: `Current Level: ${upgrades.maxThreadsLevel}. Max Concurrent Threads: ${calculateMaxThreads(gameState)}.`
    }
  ];

  return (
    <div className="bg-background-secondary p-4 rounded border border-border-primary shadow-md mb-4">
      <h2 className="text-lg font-semibold mb-3 text-accent-secondary">System Upgrades</h2>
      
      <div className="space-y-4">
        {upgradeItems.map((item) => {
          const baseCost = upgradeCosts[item.key];
          const actualCost = Math.floor(baseCost * actualCostMultiplier);
          const canAfford = resources.ticks >= actualCost;

          // For memory, show what the next level's max memory would be
          let itemDescription = item.description;
          if (item.key === 'memory') {
            const nextLevelMemory = calculateActualMaxMemoryValue(item.level + 1, metaKnowledge.buffs.memoryMultiplier);
            itemDescription = `Current Level: ${item.level}. Max Memory: ${resources.maxMemory.toFixed(0)} CU. (Next Lvl: ${nextLevelMemory.toFixed(0)} CU)`;
          }
          if (item.key === 'maxThreads') {
             const nextLevelThreads = calculateMaxThreads({...gameState, upgrades: {...upgrades, maxThreadsLevel: item.level + 1 }});
             itemDescription = `Current Level: ${item.level}. Max Threads: ${calculateMaxThreads(gameState)}. (Next Lvl: ${nextLevelThreads} Threads)`;
          }


          return (
            <div key={item.key} className="p-3 bg-gray-900 rounded border border-border-secondary">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-1 gap-1 sm:gap-2">
                <span className="text-text-primary font-medium">{item.name} (Lvl {item.level})</span>
                <span className="text-sm text-text-secondary font-mono whitespace-nowrap">Cost: {actualCost} Ticks</span>
              </div>
              <p className="text-xs text-text-secondary mb-2">{itemDescription}</p>
              <button
                onClick={() => buyUpgrade(item.key, actualCost)}
                disabled={!canAfford}
                className="w-full px-3 py-2 rounded font-semibold bg-accent-secondary hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 text-sm"
                title={!canAfford ? `Not enough Ticks (Need ${actualCost})` : `Upgrade to Level ${item.level + 1}`}
              >
                Upgrade {item.name}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default UpgradePanel;