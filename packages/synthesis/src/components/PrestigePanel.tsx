// src/components/PrestigePanel.tsx
import React from 'react';
import { type GameState, type MetaKnowledge } from '../types/gameState';
// Import the centralized getMetaBuffUpgradeCost function
import { getMetaBuffUpgradeCost } from '../utils/gameCalculations';
// PRESTIGE_MK_COST_MULTIPLIER_CAP is used by getMetaBuffUpgradeCost, no direct import needed here.

interface PrestigePanelProps {
  gameState: GameState;
  onPrestige: () => void;
  onSpendMetaKnowledge: (buffKey: keyof MetaKnowledge['buffs']) => void;
  calculateMkGain: () => number;
}

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
      description: "Globally increases tick generation by 5% additively per point.", // The original implementation in getMetaBuffUpgradeCost implies this.
      formatValue: (val) => `x${val.toFixed(2)}`
    },
    costMultiplier: {
      name: "Cost Reduction",
      description: "Reduces all Ticks-based upgrade costs by 2% per point (max 50% total reduction).", // Matched to PRESTIGE_MK_COST_MULTIPLIER_CAP
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
            // The onPrestige action itself should handle confirmation for 0 MK gain.
            // Visually, the button text indicates the gain.
            title={mkToGain < 1 ? "Make more progress to gain MK upon prestige." : `Gain ${mkToGain} MK upon prestige.`}
            className="w-full sm:w-auto px-4 py-2 rounded font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors duration-150"
          >
            Prestige (Gain {mkToGain} MK)
          </button>
        </div>
        {mkToGain < 1 && gameState.totalTicksGeneratedAllTime > 0 && <p className="text-xs text-yellow-400 mt-1">Current progress will yield no new MK.</p>}
      </div>

      <h3 className="text-md font-semibold mb-3 text-text-primary">Spend Meta-Knowledge:</h3>
      <div className="space-y-3">
        {(Object.keys(metaKnowledge.buffs) as Array<keyof MetaKnowledge['buffs']>).map((key) => {
          const currentBuffValue = metaKnowledge.buffs[key];
          // Use the imported getMetaBuffUpgradeCost
          const cost = getMetaBuffUpgradeCost(key, currentBuffValue);
          const info = buffInfo[key];
          
          // Check if max level is reached by seeing if cost is Infinity
          // (as getMetaBuffUpgradeCost returns Infinity for capped buffs)
          const isMaxedOut = cost === Infinity;

          return (
            <div key={key} className="p-3 bg-gray-900 rounded border border-border-secondary">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-1 gap-2">
                <span className="text-text-primary font-medium">{info.name} ({info.formatValue(currentBuffValue)})</span>
                <button
                  onClick={() => onSpendMetaKnowledge(key)}
                  disabled={metaKnowledge.points < cost || isMaxedOut}
                  className="w-full sm:w-auto px-3 py-1.5 rounded text-sm font-semibold bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150"
                >
                  {isMaxedOut ? "Maxed Out" : `Improve (Cost: ${cost} MK)`}
                </button>
              </div>
              <p className="text-xs text-text-secondary">{info.description}</p>
              {isMaxedOut && key === 'costMultiplier' && <p className="text-xs text-yellow-400 mt-1">Maximum cost reduction reached.</p>}
              {isMaxedOut && key !== 'costMultiplier' && <p className="text-xs text-yellow-400 mt-1">Maximum effect reached for this buff.</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PrestigePanel;