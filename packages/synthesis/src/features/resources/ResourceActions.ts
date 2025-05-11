// src/features/resources/ResourceActions.ts
import { type GameState } from '../../types/gameState';
import { type Toast } from '../../components/ToastSystem';

export const produceTickManually = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>
) => {
  setGameState(prev => ({
    ...prev,
    resources: { ...prev.resources, ticks: prev.resources.ticks + 1 },
    totalTicksGeneratedAllTime: prev.totalTicksGeneratedAllTime + 1,
  }));
};

export const garbageCollect = (
  gameState: GameState,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  addToast: (message: string, type?: Toast['type']) => void
) => {
  const baseCost = 10;
  const actualCost = Math.floor(baseCost * gameState.metaKnowledge.buffs.costMultiplier);

  if (gameState.resources.ticks < actualCost) {
      addToast(`Not enough Ticks for Garbage Collection. Cost: ${actualCost} Ticks.`, "error");
      return;
  }
  
  setGameState(prev => {
    const currentActualCost = Math.floor(baseCost * prev.metaKnowledge.buffs.costMultiplier);
    if (prev.resources.ticks < currentActualCost) { // Re-check cost
        return prev;
    }

    const entropyReductionAmount = 20 * prev.metaKnowledge.buffs.entropyReductionMultiplier;
    const activeProcessesToReduce = Math.floor(prev.activeProcesses * 0.25); 

    const newEntropy = Math.max(0, prev.resources.entropy - entropyReductionAmount);
    const newTicks = Math.max(0, prev.resources.ticks - currentActualCost);
    const newActiveProcesses = Math.max(0, prev.activeProcesses - activeProcessesToReduce);
    
    let toastMessage = 'Garbage Collection ran. ';
    if (newEntropy < prev.resources.entropy) {
        toastMessage += `Entropy reduced by up to ${entropyReductionAmount.toFixed(1)}. `;
    } else if (prev.resources.entropy > 0) {
        toastMessage += 'Entropy reduction hit 0. ';
    } else {
        toastMessage += 'No entropy to reduce. ';
    }
    if (newActiveProcesses < prev.activeProcesses) {
        toastMessage += `${prev.activeProcesses - newActiveProcesses} idle processes cleared.`;
    }
    addToast(toastMessage, 'info');

    return {
      ...prev,
      resources: { ...prev.resources, ticks: newTicks, entropy: newEntropy },
      activeProcesses: newActiveProcesses,
    };
  });
};