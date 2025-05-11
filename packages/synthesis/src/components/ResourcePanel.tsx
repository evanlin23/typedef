// src/components/ResourcePanel.tsx
import { Resources } from '../types/gameState';

interface ResourcePanelProps {
  resources: Resources;
  tickRate: number;
  activeProcesses: number;
}

const ResourcePanel = ({ resources, tickRate, activeProcesses }: ResourcePanelProps) => {
  return (
    <div className="bg-[color:var(--color-bg-secondary)] p-4 rounded border border-[color:var(--color-border-primary)] mb-4">
      <h2 className="text-lg font-semibold mb-2 text-[color:var(--color-accent-secondary)]">Resources</h2>
      
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
          <span className={resources.entropy > 50 ? "text-[color:var(--color-error)]" : ""}>
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

// src/components/UpgradePanel.tsx
import { Upgrades, UpgradeCosts } from '../types/gameState';

interface UpgradePanelProps {
  upgrades: Upgrades;
  costs: UpgradeCosts;
  ticks: number;
  buyUpgrade: (upgrade: string, cost: number) => void;
}

const UpgradePanel = ({ upgrades, costs, ticks, buyUpgrade }: UpgradePanelProps) => {
  return (
    <div className="bg-[color:var(--color-bg-secondary)] p-4 rounded border border-[color:var(--color-border-primary)] mb-4">
      <h2 className="text-lg font-semibold mb-2 text-[color:var(--color-accent-secondary)]">Upgrades</h2>
      
      <div className="space-y-2">
        <div className="flex flex-col">
          <div className="flex justify-between mb-1">
            <span>CPU Speed (Level {upgrades.cpuMultiplier}):</span>
            <span>{costs.cpuSpeed} ticks</span>
          </div>
          <button
            onClick={() => buyUpgrade('cpuSpeed', costs.cpuSpeed)}
            disabled={ticks < costs.cpuSpeed}
            className="bg-[color:var(--color-bg-primary)] p-1 rounded border border-[color:var(--color-border-secondary)] hover:bg-[color:var(--color-border-primary)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Upgrade CPU
          </button>
        </div>
        
        <div className="flex flex-col">
          <div className="flex justify-between mb-1">
            <span>Memory (Current: {upgrades.memory}):</span>
            <span>{costs.memory} ticks</span>
          </div>
          <button
            onClick={() => buyUpgrade('memory', costs.memory)}
            disabled={ticks < costs.memory}
            className="bg-[color:var(--color-bg-primary)] p-1 rounded border border-[color:var(--color-border-secondary)] hover:bg-[color:var(--color-border-primary)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Upgrade Memory
          </button>
        </div>
        
        <div className="flex flex-col">
          <div className="flex justify-between mb-1">
            <span>Optimization (Level {upgrades.optimization}):</span>
            <span>{costs.optimization} ticks</span>
          </div>
          <button
            onClick={() => buyUpgrade('optimization', costs.optimization)}
            disabled={ticks < costs.optimization}
            className="bg-[color:var(--color-bg-primary)] p-1 rounded border border-[color:var(--color-border-secondary)] hover:bg-[color:var(--color-border-primary)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Improve Optimizations
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpgradePanel;