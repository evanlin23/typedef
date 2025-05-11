import type { Upgrades, UpgradeCosts } from '../types/gameState';

interface UpgradePanelProps {
  upgrades: Upgrades;
  costs: UpgradeCosts;
  ticks: number;
  buyUpgrade: (upgrade: string, cost: number) => void;
}

const UpgradePanel = ({ upgrades, costs, ticks, buyUpgrade }: UpgradePanelProps) => {
  return (
    <div className="panel">
      <h2 className="text-lg font-semibold mb-2 text-blue-400">Upgrades</h2>
      
      <div className="space-y-3">
        <div className="flex flex-col">
          <div className="flex justify-between mb-1">
            <span>CPU Speed (Level {upgrades.cpuMultiplier}):</span>
            <span>{costs.cpuSpeed} ticks</span>
          </div>
          <button
            onClick={() => buyUpgrade('cpuSpeed', costs.cpuSpeed)}
            disabled={ticks < costs.cpuSpeed}
            className="btn bg-gray-800 p-1 rounded border border-gray-700 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Upgrade CPU
          </button>
        </div>
        
        <div className="flex flex-col">
          <div className="flex justify-between mb-1">
            <span>Memory (Level {upgrades.memory}):</span>
            <span>{costs.memory} ticks</span>
          </div>
          <button
            onClick={() => buyUpgrade('memory', costs.memory)}
            disabled={ticks < costs.memory}
            className="btn bg-gray-800 p-1 rounded border border-gray-700 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
            className="btn bg-gray-800 p-1 rounded border border-gray-700 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Improve Optimizations
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpgradePanel;