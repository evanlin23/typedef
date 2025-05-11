// src/components/Game.tsx
import { useState, useEffect } from 'react';
import ResourcePanel from './ResourcePanel';
import MachineLayer from './layers/MachineLayer';
import AssemblyLayer from './layers/AssemblyLayer';
import HighLevelLayer from './layers/HighLevelLayer';
import UpgradePanel from './UpgradePanel';
import { type GameState, initialGameState } from '../types/gameState';

const STORAGE_KEY = 'synthesis_game_state';

const Game = () => {
  const [gameState, setGameState] = useState<GameState>(() => {
    // Load state from localStorage on initial render
    const savedState = localStorage.getItem(STORAGE_KEY);
    return savedState ? JSON.parse(savedState) : initialGameState;
  });
  
  const [activeTab, setActiveTab] = useState('machine');
  const [autoTickEnabled, setAutoTickEnabled] = useState(false);

  // Save game state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(gameState));
  }, [gameState]);

  // Main game loop - runs every 100ms
  useEffect(() => {
    const gameLoop = setInterval(() => {
      setGameState(prevState => {
        // Generate ticks based on current tick rate
        const newTicks = prevState.resources.ticks + 
          (prevState.tickRate * (prevState.upgrades.cpuMultiplier / 10));
        
        // Calculate entropy accumulation
        const entropyGain = Math.max(0, 
          (prevState.activeProcesses * 0.01) - 
          (prevState.upgrades.optimization * 0.005)
        );
        
        // Update resources
        return {
          ...prevState,
          resources: {
            ...prevState.resources,
            ticks: Math.max(0, newTicks), // Prevent negative ticks
            entropy: Math.min(100, prevState.resources.entropy + entropyGain)
          },
          // Entropy slows tick rate
          effectiveTickRate: prevState.tickRate * (1 - (prevState.resources.entropy / 200))
        };
      });
    }, 100);

    return () => clearInterval(gameLoop);
  }, []);

  // Manually produce a tick
  const produceTick = () => {
    setGameState(prev => ({
      ...prev,
      resources: {
        ...prev.resources,
        ticks: prev.resources.ticks + 1
      }
    }));
  };

  const buyUpgrade = (upgrade: string, cost: number) => {
    if (gameState.resources.ticks < cost) return;
    
    setGameState(prev => {
      const newState = { ...prev };
      
      // Deduct cost
      newState.resources.ticks -= cost;
      
      // Apply upgrade
      switch (upgrade) {
        case 'cpuSpeed':
          newState.tickRate += 0.1;
          newState.upgrades.cpuMultiplier += 1;
          newState.upgradeCosts.cpuSpeed = Math.floor(newState.upgradeCosts.cpuSpeed * 1.5);
          break;
        case 'memory':
          newState.resources.maxMemory += 10;
          newState.upgrades.memory += 1; // Fix: Increment memory level counter
          newState.upgradeCosts.memory = Math.floor(newState.upgradeCosts.memory * 1.8);
          break;
        case 'optimization':
          newState.upgrades.optimization += 1;
          newState.upgradeCosts.optimization = Math.floor(newState.upgradeCosts.optimization * 2);
          break;
      }
      
      return newState;
    });
  };

  const runCode = (code: string, layer: string) => {
    // Simple simulation of running code
    const complexity = code.length / 10;
    const chance = Math.random();
    const success = chance > (complexity * 0.01);
    
    setGameState(prev => {
      const ticksGenerated = success ? 
        Math.floor(complexity * (layer === 'assembly' ? 2 : 5)) : 
        Math.floor(complexity * 0.2);
        
      const entropyChange = success ? 
        complexity * 0.1 : 
        complexity * 0.5;
        
      return {
        ...prev,
        resources: {
          ...prev.resources,
          ticks: prev.resources.ticks + ticksGenerated,
          entropy: Math.min(100, prev.resources.entropy + entropyChange)
        },
        activeProcesses: prev.activeProcesses + (success ? 1 : 0)
      };
    });
    
    return {
      success,
      ticksGenerated: success ? 
        Math.floor(complexity * (layer === 'assembly' ? 2 : 5)) : 
        Math.floor(complexity * 0.2)
    };
  };

  const garbageCollect = () => {
    if (gameState.resources.ticks < 10) return;
    
    setGameState(prev => ({
      ...prev,
      resources: {
        ...prev.resources,
        ticks: Math.max(0, prev.resources.ticks - 10), // Prevent negative ticks
        entropy: Math.max(0, prev.resources.entropy - 20)
      }
    }));
  };

  return (
    <div className="bg-gray-100 min-h-screen p-4 text-gray-900">
      <h1 className="text-2xl font-bold mb-4 text-center text-green-600">Synthesis</h1>
      
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="lg:w-1/4">
          <ResourcePanel 
            resources={gameState.resources} 
            tickRate={gameState.effectiveTickRate}
            activeProcesses={gameState.activeProcesses}
          />
          
          <UpgradePanel 
            upgrades={gameState.upgrades}
            costs={gameState.upgradeCosts}
            ticks={gameState.resources.ticks}
            buyUpgrade={buyUpgrade}
          />
          
          <button
            onClick={garbageCollect}
            disabled={gameState.resources.ticks < 10}
            className="w-full mt-4 bg-gray-200 p-2 rounded border border-gray-300 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Garbage Collection (10 ticks)
          </button>
        </div>
        
        <div className="lg:w-3/4 bg-gray-200 rounded border border-gray-300 p-4">
          <div className="flex border-b border-gray-300 mb-4">
            <button 
              onClick={() => setActiveTab('machine')}
              className={`px-4 py-2 ${activeTab === 'machine' ? 'text-green-600 border-b-2 border-green-600' : ''}`}
            >
              Machine
            </button>
            <button 
              onClick={() => setActiveTab('assembly')}
              className={`px-4 py-2 ${activeTab === 'assembly' ? 'text-green-600 border-b-2 border-green-600' : ''}`}
            >
              Assembly
            </button>
            <button 
              onClick={() => setActiveTab('highlevel')}
              className={`px-4 py-2 ${activeTab === 'highlevel' ? 'text-green-600 border-b-2 border-green-600' : ''}`}
            >
              High-Level Language
            </button>
          </div>
          
          {activeTab === 'machine' && (
            <MachineLayer 
              produceTick={produceTick}
              tickRate={gameState.effectiveTickRate}
              autoTickEnabled={autoTickEnabled}
              setAutoTickEnabled={setAutoTickEnabled}
            />
          )}
          
          {activeTab === 'assembly' && (
            <AssemblyLayer 
              runCode={code => runCode(code, 'assembly')}
              maxMemory={gameState.resources.maxMemory}
            />
          )}
          
          {activeTab === 'highlevel' && (
            <HighLevelLayer 
              runCode={code => runCode(code, 'highlevel')}
              maxMemory={gameState.resources.maxMemory}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default Game;