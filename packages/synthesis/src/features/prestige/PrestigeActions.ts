// src/features/prestige/PrestigeActions.ts
import { 
  type GameState, type MetaKnowledge, initialGameState,
  PRESTIGE_MK_COST_MULTIPLIER_CAP,
  calculateActualMaxMemoryValue
} from '../../types/gameState';
import { type Toast } from '../../components/ToastSystem';
import { calculateMkGain, getMetaBuffUpgradeCost } from '../../utils/gameCalculations';

export const handlePrestige = (
  gameState: GameState,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  addToast: (message: string, type?: Toast['type']) => void
): { success: boolean; mkGained: number } => { // ** Modified return type **
  const mkGained = calculateMkGain(gameState);
  const confirmMessage = mkGained < 1 
    ? "Your current progress yields 0 Meta-Knowledge. Are you sure you want to prestige? This will reset your game progress (except MK buffs)."
    : `Are you sure you want to prestige and gain ${mkGained} Meta-Knowledge? This will reset your current game progress (except MK buffs).`;

  if (!confirm(confirmMessage)) {
    addToast(mkGained < 1 ? "Prestige cancelled. Continue enhancing your system!" : "Prestige cancelled.", "info");
    return { success: false, mkGained: 0 }; // ** Return status **
  }

  const preservedMetaKnowledge: MetaKnowledge = {
    ...JSON.parse(JSON.stringify(gameState.metaKnowledge)),
    points: gameState.metaKnowledge.points + mkGained,
  };
  const preservedAutoTick = gameState.autoTickEnabled;
  
  const newInitialState = JSON.parse(JSON.stringify(initialGameState)) as GameState;

  newInitialState.metaKnowledge = preservedMetaKnowledge;
  newInitialState.autoTickEnabled = preservedAutoTick;
  newInitialState.lastSaveTime = Date.now();
  
  newInitialState.resources.maxMemory = calculateActualMaxMemoryValue(
      newInitialState.upgrades.memoryLevel, 
      newInitialState.metaKnowledge.buffs.memoryMultiplier
  );

  setGameState(newInitialState);
  // ** setActiveTab('machine') is now handled by the caller (Game.tsx) **
  addToast(mkGained > 0 
    ? `Universe Recompiled! Gained ${mkGained} Meta-Knowledge. System rebooted with enhanced potential.`
    : `System Rebooted. No Meta-Knowledge gained this cycle. Strive for greater complexity!`, 
    mkGained > 0 ? 'success' : 'info');
  
  return { success: true, mkGained }; // ** Return status **
};

export const spendMetaKnowledge = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  addToast: (message: string, type?: Toast['type']) => void,
  buffKey: keyof MetaKnowledge['buffs']
) => {
  setGameState(prev => {
    const currentBuffValue = prev.metaKnowledge.buffs[buffKey];
    const cost = getMetaBuffUpgradeCost(buffKey, currentBuffValue); 

    if (prev.metaKnowledge.points < cost) {
      addToast("Not enough Meta-Knowledge points.", 'error');
      return prev;
    }
    if (buffKey === 'costMultiplier' && currentBuffValue <= PRESTIGE_MK_COST_MULTIPLIER_CAP + 0.001) {
       addToast("Maximum cost reduction reached for this buff.", "info");
       return prev;
    }

    const newMetaKnowledge = JSON.parse(JSON.stringify(prev.metaKnowledge)) as MetaKnowledge;
    newMetaKnowledge.points -= cost;
    
    let buffName = "";
    switch (buffKey) {
      case 'tickMultiplier': newMetaKnowledge.buffs.tickMultiplier += 0.05; buffName = "Tick Multiplier"; break;
      case 'costMultiplier': newMetaKnowledge.buffs.costMultiplier = Math.max(PRESTIGE_MK_COST_MULTIPLIER_CAP, newMetaKnowledge.buffs.costMultiplier - 0.02); buffName = "Cost Reduction"; break;
      case 'entropyReductionMultiplier': newMetaKnowledge.buffs.entropyReductionMultiplier += 0.05; buffName = "Entropy Reduction"; break;
      case 'memoryMultiplier': 
        newMetaKnowledge.buffs.memoryMultiplier += 0.05; 
        buffName = "Memory Multiplier"; 
        const newMaxMemory = calculateActualMaxMemoryValue(prev.upgrades.memoryLevel, newMetaKnowledge.buffs.memoryMultiplier);
        const updatedState = {
             ...prev, 
             metaKnowledge: newMetaKnowledge,
             resources: { ...prev.resources, maxMemory: newMaxMemory }
        };
        addToast(`${buffName} buff improved! Max memory updated.`, 'success');
        return updatedState;
    }
    // Ensure floating point precision issues are handled for display/comparison if necessary
    newMetaKnowledge.buffs.tickMultiplier = parseFloat(newMetaKnowledge.buffs.tickMultiplier.toFixed(3));
    newMetaKnowledge.buffs.costMultiplier = parseFloat(newMetaKnowledge.buffs.costMultiplier.toFixed(3));
    newMetaKnowledge.buffs.entropyReductionMultiplier = parseFloat(newMetaKnowledge.buffs.entropyReductionMultiplier.toFixed(3));
    newMetaKnowledge.buffs.memoryMultiplier = parseFloat(newMetaKnowledge.buffs.memoryMultiplier.toFixed(3));

    addToast(`${buffName} buff improved!`, 'success');
    return { ...prev, metaKnowledge: newMetaKnowledge };
  });
};