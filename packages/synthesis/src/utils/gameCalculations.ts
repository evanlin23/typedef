// src/utils/gameCalculations.ts
import { type GameState, type MetaKnowledge, PRESTIGE_MK_COST_MULTIPLIER_CAP } from '../types/gameState';
// Removed: import { PRESTIGE_MK_COST_MULTIPLIER_CAP } from '../constants/gameConfig';

export const calculateMkGain = (gameState: GameState): number => {
  const fromTicks = Math.floor(gameState.totalTicksGeneratedAllTime / 1_000_000);
  const fromCpu = Math.floor(gameState.upgrades.cpuLevel / 10);
  const fromMemory = Math.floor(gameState.upgrades.memoryLevel / 5);
  const fromAICores = Math.floor(gameState.upgrades.aiCoreLevel / 5);
  const fromOptimization = Math.floor(gameState.upgrades.optimizationLevel / 8);
  const fromThreads = Math.floor(gameState.upgrades.maxThreadsLevel / 3);

  if (gameState.totalTicksGeneratedAllTime < 250_000 &&
      (gameState.upgrades.cpuLevel < 5 || gameState.upgrades.memoryLevel < 3)) {
    return 0;
  }
  const totalMk = fromTicks + fromCpu + fromMemory + fromAICores + fromOptimization + fromThreads;
  return Math.max(0, Math.floor(totalMk));
};

export const getMetaBuffUpgradeCost = (buffKey: keyof MetaKnowledge['buffs'], currentBuffValue: number): number => {
  switch (buffKey) {
    case 'tickMultiplier':
      return Math.floor((currentBuffValue - 1.0) / 0.05) + 1;
    case 'costMultiplier':
      if (currentBuffValue <= PRESTIGE_MK_COST_MULTIPLIER_CAP + 0.001) return Infinity;
      return Math.floor((1.0 - currentBuffValue) / 0.02) + 1;
    case 'entropyReductionMultiplier':
      return Math.floor((currentBuffValue - 1.0) / 0.05) + 1;
    case 'memoryMultiplier':
      return Math.floor((currentBuffValue - 1.0) / 0.05) + 1;
    default:
      return 1;
  }
};