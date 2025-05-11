// src/types/gameState.ts

export interface Resources {
  ticks: number;
  maxMemory: number;
  usedMemory: number;
  entropy: number;
}

export interface Upgrades {
  cpuMultiplier: number;
  memory: number;
  optimization: number;
}

export interface UpgradeCosts {
  cpuSpeed: number;
  memory: number;
  optimization: number;
}

export interface GameState {
  resources: Resources;
  upgrades: Upgrades;
  upgradeCosts: UpgradeCosts;
  tickRate: number;
  effectiveTickRate: number;
  activeProcesses: number;
}

export const initialGameState: GameState = {
  resources: {
    ticks: 0,
    maxMemory: 64,
    usedMemory: 0,
    entropy: 0
  },
  upgrades: {
    cpuMultiplier: 1,
    memory: 1,
    optimization: 0
  },
  upgradeCosts: {
    cpuSpeed: 10,
    memory: 25,
    optimization: 50
  },
  tickRate: 1,
  effectiveTickRate: 1,
  activeProcesses: 0
};