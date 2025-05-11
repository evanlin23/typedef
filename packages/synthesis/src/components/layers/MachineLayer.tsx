// src/components/layers/MachineLayer.tsx
import React from 'react'; // Added React import
import { type GameState, calculateEffectiveTickRate } from '../../types/gameState';

interface MachineLayerProps {
  gameState: GameState;
  produceTickManually: () => void;
  toggleAutoTick: () => void;
}

const MachineLayer = ({ 
  gameState,
  produceTickManually, 
  toggleAutoTick,
}: MachineLayerProps) => {
  const effectiveTickRate = calculateEffectiveTickRate(gameState);
  const { cpuLevel, memoryLevel } = gameState.upgrades;
  // The `calculateEffectiveTickRate` in `useGameLoop` for the auto-clicker
  // is specific to how often the "+1 Tick" event for manual clicks happens.
  // The `effectiveTickRate` here is the overall passive rate.
  // Let's calculate the auto-clicker display rate similarly to how it's done in useGameLoop.
  const autoClickerBaseRate = 1; 
  const autoClickerCpuBonus = gameState.upgrades.cpuLevel * 0.2; 
  const totalAutoClickerRate = autoClickerBaseRate + autoClickerCpuBonus;
  const effectiveManualClickRateDisplay = totalAutoClickerRate * gameState.metaKnowledge.buffs.tickMultiplier * (1 - (gameState.resources.entropy / (100 * 2)));

  return (
    <div className="animate-fadeIn">
      <h3 className="text-xl font-semibold mb-4 text-accent-primary">Machine Core Interface</h3>
      
      <div className="bg-gray-900 p-4 rounded border border-border-secondary shadow-md mb-4">
        <div className="mb-6">
          <p className="text-text-secondary text-sm">
            This layer represents the fundamental hardware of your virtual machine. Manually execute a single computation cycle 
            (generating 1 Tick) or enable Auto-Execution for continuous simulated manual cycles.
          </p>
          <p className="mt-1 text-text-secondary text-sm">
            Passive tick generation from CPU and AI upgrades occurs automatically in the background.
          </p>
        </div>
        
        <div className="flex flex-col items-center space-y-6">
          <button
            onClick={produceTickManually}
            className="bg-green-500 hover:bg-green-600 active:bg-green-700 text-white font-bold py-5 px-10 sm:py-6 sm:px-12 rounded-full transition-transform duration-150 ease-out active:scale-95 shadow-lg focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-opacity-50"
            aria-label="Execute One Computation Cycle Manually"
          >
            EXECUTE CYCLE (+1 Tick)
          </button>
          
          <div className="flex items-center space-x-3">
            <label htmlFor="auto-exec-toggle" className="text-text-primary">Auto-Execution (Manual Cycles):</label>
            <button
              id="auto-exec-toggle"
              onClick={toggleAutoTick}
              className={`px-4 py-2 rounded transition-colors duration-200 text-sm font-medium border ${
                gameState.autoTickEnabled 
                  ? 'bg-accent-primary text-black border-green-600' 
                  : 'bg-gray-700 hover:bg-gray-600 text-text-primary border-border-secondary'
              }`}
              aria-pressed={gameState.autoTickEnabled}
            >
              {gameState.autoTickEnabled ? 'ENABLED' : 'DISABLED'}
            </button>
          </div>
          {gameState.autoTickEnabled && effectiveManualClickRateDisplay > 0.05 && (
             <p className="text-xs text-text-secondary">
               Auto-executing at approx. {Math.min(1000 / 50, effectiveManualClickRateDisplay).toFixed(2)} cycles/sec.
             </p>
           )}
        </div>
      </div>
      
      <div className="bg-gray-900 p-4 rounded border border-border-secondary shadow-md">
        <h4 className="font-semibold mb-2 text-text-primary">Core System Status</h4>
        <div className="space-y-1 text-sm text-text-secondary pl-4 border-l-2 border-border-primary">
          <div className="flex justify-between">
            <span>Simulated CPU Cores:</span>
            <span className="font-mono">Level {cpuLevel}</span>
          </div>
          <div className="flex justify-between">
            <span>Memory Modules:</span>
            <span className="font-mono">Level {memoryLevel}</span>
          </div>
          <div className="flex justify-between">
            <span title="Overall passive tick generation rate from CPU & AI, after entropy">Effective Passive Clock Speed:</span>
            <span className="font-mono">{effectiveTickRate.toFixed(2)} Hz (Ticks/sec)</span>
          </div>
          <div className="flex justify-between">
            <span>Manual Cycle Execution Mode:</span>
            <span className="font-mono">{gameState.autoTickEnabled ? 'Automatic' : 'Manual'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MachineLayer;