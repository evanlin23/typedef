// src/components/layers/MachineLayer.tsx
import { useEffect } from 'react';

interface MachineLayerProps {
  produceTick: () => void;
  tickRate: number;
  autoTickEnabled: boolean;
  setAutoTickEnabled: (enabled: boolean) => void;
}

const MachineLayer = ({ produceTick, tickRate, autoTickEnabled, setAutoTickEnabled }: MachineLayerProps) => {
  // For manual clicking
  const handleClick = () => {
    produceTick();
  };
  
  // Toggle automatic ticking
  const toggleAutoTick = () => {
    setAutoTickEnabled(!autoTickEnabled);
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
      <h3 className="text-xl mb-4 text-green-600">Machine Layer</h3>
      
      <div className="bg-gray-100 p-4 rounded border border-gray-300 mb-4">
        <div className="mb-4">
          <p>The Machine Layer represents the fundamental hardware of your virtual machine.</p>
          <p className="mt-2">Click the button to manually execute a single tick, or enable auto-execution.</p>
        </div>
        
        <div className="flex flex-col items-center space-y-4">
          <button
            onClick={handleClick}
            className="bg-green-600 text-white font-bold py-8 px-16 rounded-full hover:bg-green-700 transition-colors duration-300"
          >
            EXECUTE TICK
          </button>
          
          <div className="flex items-center space-x-2">
            <span>Auto-Execute:</span>
            <button
              onClick={toggleAutoTick}
              className={`px-4 py-2 rounded ${
                autoTickEnabled 
                  ? 'bg-green-600 text-white' 
                  : 'bg-gray-200 text-gray-900'
              }`}
            >
              {autoTickEnabled ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>
      </div>
      
      <div className="bg-gray-100 p-4 rounded border border-gray-300">
        <h4 className="font-semibold mb-2">Machine Status</h4>
        <div className="space-y-2 pl-4 border-l-2 border-gray-300">
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