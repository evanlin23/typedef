// src/components/layers/MachineLayer.tsx
import { useState, useEffect } from 'react';

interface MachineLayerProps {
  produceTick: () => void;
  tickRate: number;
}

const MachineLayer = ({ produceTick, tickRate }: MachineLayerProps) => {
  const [autoTickEnabled, setAutoTickEnabled] = useState(false);
  
  // For manual clicking
  const handleClick = () => {
    produceTick();
  };
  
  // Toggle automatic ticking
  const toggleAutoTick = () => {
    setAutoTickEnabled(prev => !prev);
  };
  
  // Auto tick effect
  useEffect(() => {
    let autoTickInterval: number | null = null;
    
    if (autoTickEnabled) {
      autoTickInterval = window.setInterval(() => {
        produceTick();
      }, 1000 / tickRate);
    }
    
    return () => {
      if (autoTickInterval) window.clearInterval(autoTickInterval);
    };
  }, [autoTickEnabled, tickRate, produceTick]);
  
  return (
    <div>
      <h3 className="text-xl mb-4 text-[color:var(--color-accent-primary)]">Machine Layer</h3>
      
      <div className="bg-[color:var(--color-bg-primary)] p-4 rounded border border-[color:var(--color-border-primary)] mb-4">
        <div className="mb-4">
          <p>The Machine Layer represents the fundamental hardware of your virtual machine.</p>
          <p className="mt-2">Click the button to manually execute a single tick, or enable auto-execution.</p>
        </div>
        
        <div className="flex flex-col items-center space-y-4">
          <button
            onClick={handleClick}
            className="bg-[color:var(--color-accent-primary)] text-black font-bold py-8 px-16 rounded-full hover:bg-[color:var(--color-accent-secondary)] transition-colors duration-300"
          >
            EXECUTE TICK
          </button>
          
          <div className="flex items-center space-x-2">
            <span>Auto-Execute:</span>
            <button
              onClick={toggleAutoTick}
              className={`px-4 py-2 rounded ${
                autoTickEnabled 
                  ? 'bg-[color:var(--color-accent-primary)] text-black' 
                  : 'bg-[color:var(--color-bg-secondary)] text-[color:var(--color-text-primary)]'
              }`}
            >
              {autoTickEnabled ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>
      </div>
      
      <div className="bg-[color:var(--color-bg-primary)] p-4 rounded border border-[color:var(--color-border-primary)]">
        <h4 className="font-semibold mb-2">Machine Status</h4>
        <div className="space-y-2 pl-4 border-l-2 border-[color:var(--color-border-secondary)]">
          <div className="flex justify-between">
            <span>Processor:</span>
            <span>Basic CPU (1 core)</span>
          </div>
          <div className="flex justify-between">
            <span>Clock Speed:</span>
            <span>{tickRate.toFixed(2)} Hz</span>
          </div>
          <div className="flex justify-between">
            <span>Operation:</span>
            <span>{autoTickEnabled ? 'Automatic' : 'Manual'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MachineLayer;