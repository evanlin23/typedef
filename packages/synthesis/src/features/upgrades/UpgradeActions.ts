// src/features/upgrades/UpgradeActions.ts
import { type GameState, type UpgradeCosts, calculateActualMaxMemoryValue } from '../../types/gameState';
import { type Toast } from '../../components/ToastSystem';

export const buyUpgrade = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  addToast: (message: string, type?: Toast['type']) => void,
  upgradeKey: keyof UpgradeCosts,
  costOnClick: number
) => {
  setGameState(prev => {
    const currentStoredBaseCostForNextLevel = prev.upgradeCosts[upgradeKey]; 
    const actualPaymentCost = Math.floor(currentStoredBaseCostForNextLevel * prev.metaKnowledge.buffs.costMultiplier);

    if (prev.resources.ticks < actualPaymentCost) {
      if (costOnClick !== actualPaymentCost && Math.abs(costOnClick - actualPaymentCost) > 1) {
           addToast("Upgrade cost has changed. Please try again.", "error");
      } else {
          addToast("Not enough Ticks for this upgrade.", "error");
      }
      return prev;
    }
    
    const newState = JSON.parse(JSON.stringify(prev)) as GameState;
    newState.resources.ticks -= actualPaymentCost;
    
    let upgradeNameForToast = "";
    let newLevelForToast: number | undefined;

    const costMultipliers = { // These could also be defined in gameState.ts if they vary
      cpu: 1.5, memory: 1.6, optimization: 1.8, aiCore: 1.7, maxThreads: 2.0,
    };

    switch (upgradeKey) {
      case 'cpu':
        newState.upgrades.cpuLevel += 1;
        newState.upgradeCosts.cpu = Math.floor(currentStoredBaseCostForNextLevel * costMultipliers.cpu);
        upgradeNameForToast = "CPU Core Clock"; newLevelForToast = newState.upgrades.cpuLevel; break;
      case 'memory':
        newState.upgrades.memoryLevel += 1;
        newState.upgradeCosts.memory = Math.floor(currentStoredBaseCostForNextLevel * costMultipliers.memory);
        // Update maxMemory in resources directly
        newState.resources.maxMemory = calculateActualMaxMemoryValue(
            newState.upgrades.memoryLevel, 
            newState.metaKnowledge.buffs.memoryMultiplier
        );
        upgradeNameForToast = "Memory Capacity"; newLevelForToast = newState.upgrades.memoryLevel; break;
      case 'optimization':
        newState.upgrades.optimizationLevel += 1;
        newState.upgradeCosts.optimization = Math.floor(currentStoredBaseCostForNextLevel * costMultipliers.optimization);
        upgradeNameForToast = "System Optimization"; newLevelForToast = newState.upgrades.optimizationLevel; break;
      case 'aiCore':
        newState.upgrades.aiCoreLevel += 1;
        newState.upgradeCosts.aiCore = Math.floor(currentStoredBaseCostForNextLevel * costMultipliers.aiCore);
        upgradeNameForToast = "AI Computation Cores"; newLevelForToast = newState.upgrades.aiCoreLevel; break;
      case 'maxThreads':
        newState.upgrades.maxThreadsLevel +=1;
        newState.upgradeCosts.maxThreads = Math.floor(currentStoredBaseCostForNextLevel * costMultipliers.maxThreads);
        upgradeNameForToast = "Thread Scheduler"; newLevelForToast = newState.upgrades.maxThreadsLevel; break;
      default: 
        addToast("Error processing upgrade: Unknown upgrade key.", "error"); 
        console.error("Unknown upgrade key in buyUpgrade:", upgradeKey);
        return prev;
    }
    
    if (upgradeNameForToast && newLevelForToast !== undefined) {
        addToast(`${upgradeNameForToast} upgraded to Level ${newLevelForToast}!`, 'success');
    }
    return newState;
  });
};