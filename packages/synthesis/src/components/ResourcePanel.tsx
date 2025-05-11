// src/components/ResourcePanel.tsx
import type { GameState } from '../types/gameState';
// calculateEffectiveTickRate is fine to import.
// calculateActualMaxMemory is NOT exported with that name anymore.
// We will use gameState.resources.maxMemory for display.
import { calculateEffectiveTickRate } from '../types/gameState';

interface ResourcePanelProps {
  gameState: GameState;
}

const ResourcePanel = ({ gameState }: ResourcePanelProps) => {
  const { resources, upgrades, layerSpecificStates } = gameState;
  const effectiveTickRate = calculateEffectiveTickRate(gameState); // Passive tick rate
  
  // The actual maximum memory is now stored in state.resources.maxMemory
  const actualMaxMemory = resources.maxMemory; 
  
  const runningThreadsCount = layerSpecificStates.concurrencyThreads.filter(t => t.status === 'running').length;
  const totalDisplayedActiveProcesses = gameState.activeProcesses + runningThreadsCount;


  return (
    <div className="bg-background-secondary p-4 rounded border border-border-primary shadow-md mb-4">
      <h2 className="text-lg font-semibold mb-3 text-accent-secondary">System Monitor</h2>
      
      <div className="space-y-2 text-text-primary">
        <div className="flex justify-between">
          <span>Ticks:</span>
          <span className="font-mono">{Math.floor(resources.ticks).toLocaleString()}</span>
        </div>
        
        <div className="flex justify-between">
          <span>Passive Tick Rate:</span>
          <span className="font-mono" title="Effective rate from CPU and AI after entropy">{effectiveTickRate.toFixed(2)}/s</span>
        </div>
        
        <div className="flex justify-between">
          <span>Memory (CU):</span>
          {/* Use the actualMaxMemory variable which now points to resources.maxMemory */}
          <span className="font-mono" title={`Used: ${resources.usedMemory.toFixed(1)}, Max: ${actualMaxMemory.toFixed(0)}`}>
            {resources.usedMemory.toFixed(1)} / {actualMaxMemory.toFixed(0)}
          </span>
        </div>
        
        <div className="flex justify-between items-center">
          <span>System Entropy:</span>
          <div className="flex items-center">
            <span className={`font-mono ${resources.entropy > 70 ? "text-error-primary" : resources.entropy > 40 ? "text-yellow-400" : "text-green-400"}`}>
              {resources.entropy.toFixed(1)}%
            </span>
            <div 
              className="w-20 h-2.5 bg-gray-700 rounded-full ml-2 overflow-hidden border border-gray-600"
              title={`Entropy: ${resources.entropy.toFixed(1)}% / ${100}%`}
            >
              <div 
                className={`h-full transition-all duration-200 ease-linear ${
                  resources.entropy > 70 ? "bg-error-primary" : 
                  resources.entropy > 40 ? "bg-yellow-500" : 
                  "bg-accent-primary"
                }`}
                style={{ width: `${Math.min(100, resources.entropy)}%`}}
              />
            </div>
          </div>
        </div>
        
        <div className="flex justify-between">
          <span title="Non-concurrent tasks + Running threads">Active Processes (Total):</span>
          <span className="font-mono">{totalDisplayedActiveProcesses}</span>
        </div>
         <div className="flex justify-between text-xs text-text-secondary">
          <span title="Tasks from Assembly, High-Level layers">└ Non-Concurrent Tasks:</span>
          <span className="font-mono">{gameState.activeProcesses}</span>
        </div>
         <div className="flex justify-between text-xs text-text-secondary">
          <span title="Actively running threads in Concurrency layer">└ Running Threads:</span>
          <span className="font-mono">{runningThreadsCount}</span>
        </div>
        <div className="flex justify-between">
            <span>CPU / AI / Opt Levels:</span>
            <span className="font-mono">{upgrades.cpuLevel} / {upgrades.aiCoreLevel} / {upgrades.optimizationLevel}</span>
        </div>
      </div>
    </div>
  );
};

export default ResourcePanel;