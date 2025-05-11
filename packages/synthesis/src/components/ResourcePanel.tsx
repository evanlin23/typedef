// src/components/ResourcePanel.tsx
import type { Resources } from '../types/gameState';

interface ResourcePanelProps {
  resources: Resources;
  tickRate: number;
  activeProcesses: number;
}

const ResourcePanel = ({ resources, tickRate, activeProcesses }: ResourcePanelProps) => {
  return (
    <div className="bg-gray-200 p-4 rounded border border-gray-300 mb-4">
      <h2 className="text-lg font-semibold mb-2 text-blue-600">Resources</h2>
      
      <div className="space-y-2">
        <div className="flex justify-between">
          <span>Ticks:</span>
          <span>{Math.floor(resources.ticks)}</span>
        </div>
        
        <div className="flex justify-between">
          <span>Tick Rate:</span>
          <span>{tickRate.toFixed(2)}/s</span>
        </div>
        
        <div className="flex justify-between">
          <span>Memory:</span>
          <span>{resources.usedMemory} / {resources.maxMemory} MB</span>
        </div>
        
        <div className="flex justify-between">
          <span>Entropy:</span>
          <span className={resources.entropy > 50 ? "text-red-600" : ""}>
            {resources.entropy.toFixed(1)}%
          </span>
        </div>
        
        <div className="flex justify-between">
          <span>Active Processes:</span>
          <span>{activeProcesses}</span>
        </div>
      </div>
    </div>
  );
};

export default ResourcePanel;