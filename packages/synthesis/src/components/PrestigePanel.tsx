// src/components/PrestigePanel.tsx
import React from 'react';
import { type GameState, type MetaKnowledge } from '../types/gameState';

interface PrestigePanelProps {
  gameState: GameState;
  onPrestige: () => void;
  onSpendMetaKnowledge: (buffKey: keyof MetaKnowledge['buffs']) => void;
  calculateMkGain: () => number;
}

// This helper function will now be responsible for accurately calculating the cost
export const getMetaBuffUpgradeCost = (buffKey: keyof MetaKnowledge['buffs'], currentBuffValue: number): number => {
  let level = 0;
  const precisionFix = 0.00001; // To handle floating point comparisons

  switch (buffKey) {
    case 'tickMultiplier':
    case 'entropyReductionMultiplier':
    case 'memoryMultiplier':
      // Buffs start at 1.0 and increase by 0.05 per step
      level = Math.round(((currentBuffValue + precisionFix) - 1.0) / 0.05);
      break;
    case 'costMultiplier':
      // Buff starts at 1.0 and decreases by 0.02 per step (down to 0.5)
      level = Math.round((1.0 - (currentBuffValue - precisionFix)) / 0.02);
      break;
    default:
      return 999; // Should not happen
  }
  
  level = Math.max(0, level); // Ensure level is not negative

  // Cost scaling: 1 MK for first few levels, then increases
  // Example: Cost = 1 for levels 0-1, 2 for levels 2-3, 3 for levels 4-5 etc.
  const baseCost = 1;
  const costIncreasePerXLevels = 2; // Cost increases by 1 every 2 levels invested
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

  const buffDescriptions: Record<keyof MetaKnowledge['buffs'], string> = {
    tickMultiplier: "Increases global tick generation by 5% per point.",
    costMultiplier: "Reduces all upgrade costs by 2% per point (max 50% reduction).",
    entropyReductionMultiplier: "Enhances entropy reduction effects by 5% per point.",
    memoryMultiplier: "Increases maximum memory capacity by 5% per point.",
  };

  return (
    <div className="bg-background-secondary p-4 rounded border border-border-primary shadow-md animate-fadeIn">
      <h2 className="text-lg font-semibold mb-3 text-accent-secondary">Prestige - Meta-Knowledge</h2>
      
      <p className="text-sm text-text-secondary mb-4">
        Reset your current progress to gain Meta-Knowledge (MK). MK can be spent on powerful permanent buffs
        that persist through prestiges, accelerating future playthroughs.
      </p>

      <div className="mb-6 p-3 bg-gray-900 rounded border border-border-secondary">
        <div className="flex justify-between items-center">
          <span className="text-text-primary">Meta-Knowledge Points: {gameState.metaKnowledge.points} MK</span>
          <button
            onClick={onPrestige}
            disabled={mkToGain < 1}
            title={mkToGain < 1 ? "Generate more ticks or acquire more upgrades to prestige" : `Gain ${mkToGain} MK`}
            className="px-4 py-2 rounded font-semibold bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150"
          >
            Prestige (Gain {mkToGain} MK)
          </button>
        </div>
        {mkToGain < 1 && <p className="text-xs text-red-400 mt-1">You need to make more progress to gain MK.</p>}
      </div>

      <h3 className="text-md font-semibold mb-2 text-text-primary">Spend Meta-Knowledge:</h3>
      <div className="space-y-3">
        {(Object.keys(gameState.metaKnowledge.buffs) as Array<keyof MetaKnowledge['buffs']>).map((key) => {
          const currentBuffValue = gameState.metaKnowledge.buffs[key];
          const cost = getMetaBuffUpgradeCost(key, currentBuffValue); // Use the new helper
          
          let displayEffect: string;
          if (key === 'costMultiplier') {
            displayEffect = `${((1 - currentBuffValue) * 100).toFixed(0)}% cheaper`;
          } else {
            displayEffect = `x${currentBuffValue.toFixed(2)}`;
          }
          const isMaxCostReduction = key === 'costMultiplier' && currentBuffValue <= 0.501; // Check with precision

          return (
            <div key={key} className="p-3 bg-gray-900 rounded border border-border-secondary">
              <div className="flex justify-between items-center mb-1">
                <span className="capitalize text-text-primary">{key.replace(/Multiplier$/, '')} Buff ({displayEffect})</span>
                <button
                  onClick={() => onSpendMetaKnowledge(key)}
                  disabled={gameState.metaKnowledge.points < cost || isMaxCostReduction}
                  className="px-3 py-1 rounded text-sm bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150"
                >
                  Improve (Cost: {cost} MK)
                </button>
              </div>
              <p className="text-xs text-text-secondary">{buffDescriptions[key]}</p>
              {isMaxCostReduction && <p className="text-xs text-yellow-400 mt-1">Max cost reduction reached.</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PrestigePanel;