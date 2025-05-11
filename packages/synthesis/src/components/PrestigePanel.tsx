// src/components/PrestigePanel.tsx
import React from 'react';
import { type GameState, type MetaKnowledge } from '../types/gameState';

interface PrestigePanelProps {
  gameState: GameState;
  onPrestige: () => void;
  onSpendMetaKnowledge: (buffKey: keyof MetaKnowledge['buffs']) => void;
  calculateMkGain: () => number;
}

// Helper to calculate the cost of the next Meta-Knowledge buff upgrade.
// Exported for use in Game.tsx to ensure consistency if needed, though primarily used here.
export const getMetaBuffUpgradeCost = (buffKey: keyof MetaKnowledge['buffs'], currentBuffValue: number): number => {
  let level = 0; // Represents how many times this buff has been upgraded
  const precisionFix = 0.00001; // To handle floating point comparisons

  switch (buffKey) {
    case 'tickMultiplier':
    case 'entropyReductionMultiplier':
    case 'memoryMultiplier':
      // These buffs start at 1.0 and increase by 0.05 per upgrade.
      // level = (currentBuffValue - initialValue) / incrementStep
      level = Math.round(((currentBuffValue + precisionFix) - 1.0) / 0.05);
      break;
    case 'costMultiplier':
      // This buff starts at 1.0 and decreases by 0.02 per upgrade (down to a min of 0.5).
      // level = (initialValue - currentBuffValue) / decrementStep
      level = Math.round((1.0 - (currentBuffValue - precisionFix)) / 0.02);
      break;
    default:
      // Should not be reached if buffKey is valid
      console.error("Unknown buffKey in getMetaBuffUpgradeCost:", buffKey);
      return 9999; 
  }
  
  level = Math.max(0, level); // Ensure level is non-negative

  // Cost scaling: Base cost + additional cost based on current level
  // Example: Cost = 1 for levels 0-1, 2 for levels 2-3, 3 for levels 4-5 etc.
  const baseCost = 1;
  const costIncreasePerXLevels = 2; // Cost increases by 1 MK for every 2 levels invested
  const additionalCost = Math.floor(level / costIncreasePerXLevels);
  
  return baseCost + additionalCost;
};


const PrestigePanel: React.FC<PrestigePanelProps> = ({
  gameState,
  onPrestige,
  onSpendMetaKnowledge,
  calculateMkGain,
}) => {
  const mkToGain = calculateMkGain();
  const { metaKnowledge } = gameState;

  const buffInfo: Record<keyof MetaKnowledge['buffs'], { name: string; description: string; formatValue: (val: number) => string }> = {
    tickMultiplier: { 
      name: "Tick Multiplier",
      description: "Globally increases tick generation by 5% additively per point.",
      formatValue: (val) => `x${val.toFixed(2)}`
    },
    costMultiplier: {
      name: "Cost Reduction",
      description: "Reduces all Ticks-based upgrade costs by 2% multiplicatively per point (max 50% total reduction).",
      formatValue: (val) => `${((1 - val) * 100).toFixed(0)}% Cheaper`
    },
    entropyReductionMultiplier: {
      name: "Entropy Control",
      description: "Enhances all entropy reduction effects by 5% additively per point.",
      formatValue: (val) => `x${val.toFixed(2)} Effect`
    },
    memoryMultiplier: {
      name: "Memory Expansion",
      description: "Increases maximum memory capacity globally by 5% additively per point.",
      formatValue: (val) => `x${val.toFixed(2)} Capacity`
    },
  };

  return (
    <div className="bg-background-secondary p-4 rounded border border-border-primary shadow-md animate-fadeIn">
      <h2 className="text-lg font-semibold mb-3 text-accent-secondary">Prestige - Meta-Knowledge</h2>
      
      <p className="text-sm text-text-secondary mb-4">
        Reset your current progress (except Meta-Knowledge buffs) to gain Meta-Knowledge (MK). 
        MK is spent on powerful permanent buffs that persist through prestiges, accelerating future playthroughs.
      </p>

      <div className="mb-6 p-3 bg-gray-900 rounded border border-border-secondary">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-2">
          <span className="text-text-primary">Available Meta-Knowledge: {metaKnowledge.points} MK</span>
          <button
            onClick={onPrestige}
            // Allow prestiging for 0 MK if user confirms, but visually disable if no gain
            disabled={mkToGain < 0} // Effectively never disabled by this, relies on confirm logic
            title={mkToGain < 1 ? "Make more progress to gain MK upon prestige." : `Gain ${mkToGain} MK upon prestige.`}
            className="w-full sm:w-auto px-4 py-2 rounded font-semibold bg-red-600 hover:bg-red-700 text-white disabled:opacity-60 disabled:cursor-not-allowed transition-colors duration-150"
          >
            Prestige (Gain {mkToGain} MK)
          </button>
        </div>
        {mkToGain < 1 && <p className="text-xs text-yellow-400 mt-1">Current progress will yield no new MK.</p>}
      </div>

      <h3 className="text-md font-semibold mb-3 text-text-primary">Spend Meta-Knowledge:</h3>
      <div className="space-y-3">
        {(Object.keys(metaKnowledge.buffs) as Array<keyof MetaKnowledge['buffs']>).map((key) => {
          const currentBuffValue = metaKnowledge.buffs[key];
          const cost = getMetaBuffUpgradeCost(key, currentBuffValue);
          const info = buffInfo[key];
          
          // Check if max level for cost reduction is reached
          const isMaxCostReduction = key === 'costMultiplier' && currentBuffValue <= 0.501; // Max 50% reduction (0.5)

          return (
            <div key={key} className="p-3 bg-gray-900 rounded border border-border-secondary">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-1 gap-2">
                <span className="text-text-primary font-medium">{info.name} ({info.formatValue(currentBuffValue)})</span>
                <button
                  onClick={() => onSpendMetaKnowledge(key)}
                  disabled={metaKnowledge.points < cost || isMaxCostReduction}
                  className="w-full sm:w-auto px-3 py-1.5 rounded text-sm font-semibold bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150"
                >
                  Improve (Cost: {cost} MK)
                </button>
              </div>
              <p className="text-xs text-text-secondary">{info.description}</p>
              {isMaxCostReduction && <p className="text-xs text-yellow-400 mt-1">Maximum effect reached for this buff.</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PrestigePanel;