// src/features/code/CodeExecution.ts
import { 
  type GameState, type LayerBuff, type ActiveLayerBuffs,
  MAX_ENTROPY, CODE_COST_ASSEMBLY_PER_CHAR, CODE_COST_HIGHLEVEL_PER_CHAR 
} from '../../types/gameState';
import { type Toast } from '../../components/ToastSystem'; // Assuming Toast is defined here

export const runCode = (
  gameState: GameState,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  codeFromLayer: string,
  layer: string,
  _threadId?: number // threadId is used by concurrency layer to know which thread ran.
): { success: boolean; ticksGenerated: number } => {
  let codeToRun: string;
  // ** Logic to determine actual code to run based on layer **
  // ** Concurrency passes codeFromLayer directly, others use gameState **
  switch (layer) {
      case 'assembly': codeToRun = gameState.layerSpecificStates.assemblyCode; break;
      case 'highLevel': codeToRun = gameState.layerSpecificStates.highLevelCode; break;
      // For 'concurrency', codeFromLayer is the specific thread's code.
      default: codeToRun = codeFromLayer; 
  }

  let currentCodeCost = 0;
  if (layer === 'assembly') currentCodeCost = codeToRun.length * CODE_COST_ASSEMBLY_PER_CHAR;
  else if (layer === 'highLevel' || layer === 'concurrency') currentCodeCost = codeToRun.length * CODE_COST_HIGHLEVEL_PER_CHAR;

  const complexity = codeToRun.length / (layer === 'assembly' ? 50 : 25); 
  const baseSuccessChance = 0.95; 
  const successChance = Math.max(0.1, baseSuccessChance - (complexity * 0.02));
  const success = Math.random() < successChance;
  
  const layerBuff = gameState.activeLayerBuffs[layer as keyof ActiveLayerBuffs];
  const buffMultiplier = (layerBuff && layerBuff.isActive) ? layerBuff.effectMultiplier : 1.0;

  let ticksGenerated = 0;
  let entropyChange = 0;

  if (success) {
    const layerTickMultiplier = layer === 'assembly' ? 1.5 : layer === 'concurrency' ? 3.0 : 2.5;
    ticksGenerated = Math.floor( (5 + complexity * 2) * layerTickMultiplier * buffMultiplier * gameState.metaKnowledge.buffs.tickMultiplier );
    entropyChange = complexity * 0.05;
  } else {
    ticksGenerated = Math.floor( (1 + complexity * 0.5) * buffMultiplier );
    entropyChange = complexity * 0.25;
  }
  
  setGameState(prev => {
    let newActiveProcesses = prev.activeProcesses;
    // Only increment active processes for non-concurrent, successful runs.
    // Concurrency layer manages its own running state visually.
    if (success && layer !== 'concurrency') {
        newActiveProcesses += 1;
    }
    const cappedActiveProcesses = Math.min(newActiveProcesses, 50 + prev.upgrades.cpuLevel * 5); 
    const newUsedMemory = Math.min(prev.resources.maxMemory, prev.resources.usedMemory + currentCodeCost);

    return {
      ...prev,
      resources: {
        ...prev.resources,
        ticks: prev.resources.ticks + ticksGenerated,
        entropy: Math.min(MAX_ENTROPY, Math.max(0, prev.resources.entropy + entropyChange)),
        usedMemory: newUsedMemory,
      },
      activeProcesses: cappedActiveProcesses,
      totalTicksGeneratedAllTime: prev.totalTicksGeneratedAllTime + ticksGenerated,
    };
  });

  // Timeout for non-concurrent successful processes to clear up memory and process count
  if (success && layer !== 'concurrency') { 
    setTimeout(() => {
      setGameState(prev => ({
        ...prev, 
        activeProcesses: Math.max(0, prev.activeProcesses - 1),
        resources: { 
          ...prev.resources, 
          // Free up memory used by this specific process
          usedMemory: Math.max(0, prev.resources.usedMemory - currentCodeCost)
        }
      }));
    }, 5000 + Math.random() * 5000);
  }
  return { success, ticksGenerated };
};

export const runUnitTests = (
  gameState: GameState,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  addToast: (message: string, type?: Toast['type']) => void,
  layer: string
) => {
  const testCosts = { assembly: 5, highLevel: 15, concurrency: 10 }; 
  const cost = testCosts[layer as keyof typeof testCosts] || 10;
  
  if (gameState.resources.ticks < cost) {
    addToast(`Not enough Ticks for ${layer} unit tests. Cost: ${cost} Ticks.`, 'error');
    return;
  }

  setGameState(prev => {
    // Re-check cost inside setGameState to avoid race conditions if ticks changed
    if (prev.resources.ticks < cost) return prev; 
    
    const testSuccess = Math.random() < 0.7;
    let newActiveLayerBuffs = { ...prev.activeLayerBuffs };
    let newEntropy = prev.resources.entropy;

    if (testSuccess) {
      const buffDurationMs = 60 * 1000;
      const buffMultiplier = 1.2;
      const newBuff: LayerBuff = {
        id: `${layer}_test_buff_${Date.now()}`,
        isActive: true,
        expiresAt: Date.now() + buffDurationMs,
        effectMultiplier: buffMultiplier,
        description: `+20% tick output from ${layer} layer for 1 min.`
      };
      newActiveLayerBuffs[layer as keyof ActiveLayerBuffs] = newBuff;
      addToast(`Unit tests for ${layer} passed! Output boosted by 20% for 1 minute.`, 'success');
    } else {
      const entropyPenalty = layer === 'assembly' ? 3 : 5;
      newEntropy = Math.min(MAX_ENTROPY, prev.resources.entropy + entropyPenalty);
      addToast(`Unit tests for ${layer} found issues! Entropy increased by ${entropyPenalty}.`, 'error');
    }

    return {
      ...prev,
      resources: { 
        ...prev.resources, 
        ticks: Math.max(0, prev.resources.ticks - cost),
        entropy: newEntropy 
      },
      activeLayerBuffs: newActiveLayerBuffs,
    };
  });
};