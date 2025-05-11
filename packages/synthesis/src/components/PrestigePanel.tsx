// src/components/PrestigePanel.tsx
import React from 'react';
import { useGameContext } from '../contexts/GameContext'; // ** Import useGameContext **
import { type MetaKnowledge } from '../types/gameState';
import { getMetaBuffUpgradeCost } from '../utils/gameCalculations';

const PrestigePanel: React.FC = () => {
  const { 
    gameState, 
    handlePrestige,  // ** Use from context **
    spendMetaKnowledge, // ** Use from context **
    calculateMkGain    // ** Use from context **
  } = useGameContext(); 

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
      description: "Reduces all Ticks-based upgrade costs by 2% per point (max 50% total reduction).",
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
            onClick={handlePrestige} // ** Use from context **
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
          const cost = getMetaBuffUpgradeCost(key, currentBuffValue);
          const info = buffInfo[key];
          const isMaxedOut = cost === Infinity;

          return (
            <div key={key} className="p-3 bg-gray-900 rounded border border-border-secondary">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-1 gap-2">
                <span className="text-text-primary font-medium">{info.name} ({info.formatValue(currentBuffValue)})</span>
                <button
                  onClick={() => spendMetaKnowledge(key)} // ** Use from context **
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