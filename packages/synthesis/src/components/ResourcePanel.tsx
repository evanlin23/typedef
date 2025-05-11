import type { GameState } from '../types/gameState'; // Added GameState
import { calculateEffectiveTickRate, calculateActualMaxMemory } from '../types/gameState'; // Import helpers

interface ResourcePanelProps {
  gameState: GameState; // Pass full gameState
}

const ResourcePanel = ({ gameState }: ResourcePanelProps) => {
  const { resources, activeProcesses } = gameState;
  const effectiveTickRate = calculateEffectiveTickRate(gameState);
  const actualMaxMemory = calculateActualMaxMemory(gameState);

  return (
    <div className="bg-background-secondary p-4 rounded border border-border-primary shadow-md mb-4">
      <h2 className="text-lg font-semibold mb-3 text-accent-secondary">System Resources</h2>
      
      <div className="space-y-2 text-text-primary">
        <div className="flex justify-between">
          <span>Ticks:</span>
          <span className="font-mono">{Math.floor(resources.ticks)}</span>
        </div>
        
        <div className="flex justify-between">
          <span>Tick Rate (Effective):</span>
          <span className="font-mono">{effectiveTickRate.toFixed(2)}/s</span>
        </div>
        
        <div className="flex justify-between">
          <span>Memory (CU):</span>
          <span className="font-mono">{resources.usedMemory.toFixed(1)} / {actualMaxMemory.toFixed(0)}</span>
        </div>
        
        <div className="flex justify-between items-center">
          <span>Entropy:</span>
          <div className="flex items-center">
            <span className={`font-mono ${resources.entropy > 70 ? "text-error-primary" : resources.entropy > 40 ? "text-yellow-400" : ""}`}>
              {resources.entropy.toFixed(1)}%
            </span>
            <div className="w-16 h-2 bg-gray-700 rounded ml-2 overflow-hidden">
              <div 
                className={`h-full ${resources.entropy > 70 ? "bg-error-primary" : resources.entropy > 40 ? "bg-yellow-400" : "bg-accent-primary"}`}
                style={{ width: `${resources.entropy}%`}} 
              />
            </div>
          </div>
        </div>
        
        <div className="flex justify-between">
          <span>Active Processes:</span>
          <span className="font-mono">{activeProcesses}</span>
        </div>
      </div>
    </div>
  );
};

export default ResourcePanel;