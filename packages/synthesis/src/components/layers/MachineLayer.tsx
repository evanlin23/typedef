import { useCallback } from 'react';
import { type GameState, calculateEffectiveTickRate } from '../../types/gameState';

interface MachineLayerProps {
  gameState: GameState;
  produceTickManually: () => void; // Renamed for clarity
  toggleAutoTick: () => void;
}

const MachineLayer = ({ 
  gameState,
  produceTickManually, 
  toggleAutoTick,
}: MachineLayerProps) => {
  const effectiveTickRate = calculateEffectiveTickRate(gameState);
  
  return (
    <div className="animate-fadeIn">
      <h3 className="text-xl mb-4 text-accent-primary">Machine Layer</h3>
      
      <div className="bg-background-secondary p-4 rounded border border-border-primary shadow-md mb-4">
        <div className="mb-6">
          <p className="text-text-secondary">The Machine Layer represents the fundamental hardware of your virtual machine.</p>
          <p className="mt-1 text-text-secondary">Manually execute a single computation cycle (tick), or enable auto-execution for continuous processing.</p>
        </div>
        
        <div className="flex flex-col items-center space-y-6">
          <button
            onClick={produceTickManually}
            className="bg-green-500 hover:bg-green-600 active:bg-green-700 text-white font-bold py-6 px-12 sm:py-8 sm:px-16 rounded-full transition-colors duration-300 shadow-lg focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-opacity-50"
            aria-label="Execute Tick Manually"
          >
            EXECUTE CYCLE
          </button>
          
          <div className="flex items-center space-x-3">
            <span className="text-text-primary">Auto-Execution:</span>
            <button
              onClick={toggleAutoTick}
              className={`px-4 py-2 rounded transition-colors duration-200 text-sm font-medium ${
                gameState.autoTickEnabled 
                  ? 'bg-accent-primary text-black' 
                  : 'bg-gray-700 hover:bg-gray-600 text-text-primary border border-border-secondary'
              }`}
            >
              {gameState.autoTickEnabled ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>
      </div>
      
      <div className="bg-background-secondary p-4 rounded border border-border-primary shadow-md">
        <h4 className="font-semibold mb-2 text-text-primary">Machine Status</h4>
        <div className="space-y-1 text-sm text-text-secondary pl-4 border-l-2 border-border-secondary">
          <div className="flex justify-between">
            <span>Processor Cores (Simulated):</span>
            <span>{gameState.upgrades.cpuLevel}</span>
          </div>
          <div className="flex justify-between">
            <span>Effective Clock Speed:</span>
            <span>{effectiveTickRate.toFixed(2)} Hz (Cycles/sec)</span>
          </div>
           <div className="flex justify-between">
            <span>Memory Modules:</span>
            <span>Level {gameState.upgrades.memoryLevel}</span>
          </div>
          <div className="flex justify-between">
            <span>Execution Mode:</span>
            <span>{gameState.autoTickEnabled ? 'Automatic' : 'Manual'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MachineLayer;