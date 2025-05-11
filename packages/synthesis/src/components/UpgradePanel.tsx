import type { UpgradeCosts, GameState } from '../types/gameState'; // Added GameState
import { calculateActualMaxMemory, calculateMaxThreads } from '../types/gameState'; // Import helpers

interface UpgradePanelProps {
  gameState: GameState; // Pass full gameState
  buyUpgrade: (upgradeKey: keyof UpgradeCosts, cost: number) => void;
}

const UpgradePanel = ({ gameState, buyUpgrade }: UpgradePanelProps) => {
  const { upgrades, upgradeCosts, resources, metaKnowledge } = gameState;
  const actualCostMultiplier = metaKnowledge.buffs.costMultiplier;

  const upgradeItems = [
    { 
      key: 'cpu' as keyof UpgradeCosts, 
      name: 'CPU Core Clock', 
      level: upgrades.cpuLevel,
      description: `Current Level: ${upgrades.cpuLevel}. Boosts base tick generation.`
    },
    { 
      key: 'memory' as keyof UpgradeCosts, 
      name: 'Memory Capacity', 
      level: upgrades.memoryLevel,
      description: `Current Level: ${upgrades.memoryLevel}. Max CU: ${calculateActualMaxMemory(gameState).toFixed(0)}.`
    },
    { 
      key: 'optimization' as keyof UpgradeCosts, 
      name: 'System Optimization', 
      level: upgrades.optimizationLevel,
      description: `Current Level: ${upgrades.optimizationLevel}. Reduces entropy buildup.`
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
      description: `Current Level: ${upgrades.maxThreadsLevel}. Max Threads: ${calculateMaxThreads(gameState)}.`
    }
  ];

  return (
    <div className="bg-background-secondary p-4 rounded border border-border-primary shadow-md mb-4">
      <h2 className="text-lg font-semibold mb-3 text-accent-secondary">System Upgrades</h2>
      
      <div className="space-y-4">
        {upgradeItems.map((item) => {
          const cost = Math.floor(upgradeCosts[item.key] * actualCostMultiplier);
          return (
            <div key={item.key} className="p-3 bg-gray-900 rounded border border-border-secondary">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-1">
                <span className="text-text-primary font-medium">{item.name}</span>
                <span className="text-sm text-text-secondary font-mono">Cost: {cost} Ticks</span>
              </div>
              <p className="text-xs text-text-secondary mb-2">{item.description}</p>
              <button
                onClick={() => buyUpgrade(item.key, cost)}
                disabled={resources.ticks < cost}
                className="w-full px-3 py-2 rounded font-semibold bg-accent-secondary hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 text-sm"
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