// src/features/prestige/PrestigeActions.ts
import { 
  type GameState, type MetaKnowledge, initialGameState, type LayerSpecificStates,
  PRESTIGE_MK_COST_MULTIPLIER_CAP, // Import from gameState
  calculateActualMaxMemoryValue // For resetting maxMemory on prestige
} from '../../types/gameState';
import { type Toast } from '../../components/ToastSystem';
import { calculateMkGain, getMetaBuffUpgradeCost } from '../../utils/gameCalculations'; // gameCalculations will also import CAP from gameState
// Removed: import { PRESTIGE_MK_COST_MULTIPLIER_CAP } from '../../constants/gameConfig';

export const handlePrestige = (
  gameState: GameState,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  addToast: (message: string, type?: Toast['type']) => void,
  setActiveTab: (tab: string) => void
) => {
  const mkGained = calculateMkGain(gameState); // calculateMkGain is from utils
  const confirmMessage = mkGained < 1 
    ? "Your current progress yields 0 Meta-Knowledge. Are you sure you want to prestige? This will reset your game progress (except MK buffs)."
    : `Are you sure you want to prestige and gain ${mkGained} Meta-Knowledge? This will reset your current game progress (except MK buffs).`;

  if (!confirm(confirmMessage)) {
    addToast(mkGained < 1 ? "Prestige cancelled. Continue enhancing your system!" : "Prestige cancelled.", "info");
    return;
  }

  const preservedMetaKnowledge: MetaKnowledge = {
    ...JSON.parse(JSON.stringify(gameState.metaKnowledge)), // Deep copy existing buffs
    points: gameState.metaKnowledge.points + mkGained,
  };
  const preservedAutoTick = gameState.autoTickEnabled;
  
  // Get a fresh copy of initial game state
  const newInitialState = JSON.parse(JSON.stringify(initialGameState)) as GameState;

  // Apply preserved parts
  newInitialState.metaKnowledge = preservedMetaKnowledge;
  newInitialState.autoTickEnabled = preservedAutoTick;
  newInitialState.lastSaveTime = Date.now();
  
  // Recalculate maxMemory based on initial upgrades but preserved metaKnowledge buffs
  newInitialState.resources.maxMemory = calculateActualMaxMemoryValue(
      newInitialState.upgrades.memoryLevel, 
      newInitialState.metaKnowledge.buffs.memoryMultiplier
  );


  setGameState(newInitialState);
  setActiveTab('machine');
  addToast(mkGained > 0 
    ? `Universe Recompiled! Gained ${mkGained} Meta-Knowledge. System rebooted with enhanced potential.`
    : `System Rebooted. No Meta-Knowledge gained this cycle. Strive for greater complexity!`, 
    mkGained > 0 ? 'success' : 'info');
};

export const spendMetaKnowledge = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  addToast: (message: string, type?: Toast['type']) => void,
  buffKey: keyof MetaKnowledge['buffs']
) => {
  setGameState(prev => {
    const currentBuffValue = prev.metaKnowledge.buffs[buffKey];
    // getMetaBuffUpgradeCost is from utils, which should now also use CAP from gameState.ts
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
        // Recalculate maxMemory when this buff is upgraded
        const newMaxMemory = calculateActualMaxMemoryValue(prev.upgrades.memoryLevel, newMetaKnowledge.buffs.memoryMultiplier);
        const updatedState = {
             ...prev, 
             metaKnowledge: newMetaKnowledge,
             resources: { ...prev.resources, maxMemory: newMaxMemory }
        };
        addToast(`${buffName} buff improved! Max memory updated.`, 'success');
        return updatedState; // Return early as state structure changed more deeply
    }
    newMetaKnowledge.buffs.tickMultiplier = parseFloat(newMetaKnowledge.buffs.tickMultiplier.toFixed(3));
    newMetaKnowledge.buffs.costMultiplier = parseFloat(newMetaKnowledge.buffs.costMultiplier.toFixed(3));
    newMetaKnowledge.buffs.entropyReductionMultiplier = parseFloat(newMetaKnowledge.buffs.entropyReductionMultiplier.toFixed(3));
    newMetaKnowledge.buffs.memoryMultiplier = parseFloat(newMetaKnowledge.buffs.memoryMultiplier.toFixed(3));

    addToast(`${buffName} buff improved!`, 'success');
    return { ...prev, metaKnowledge: newMetaKnowledge };
  });
};