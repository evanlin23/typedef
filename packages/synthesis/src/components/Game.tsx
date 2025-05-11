import React, { useState, useEffect, useCallback } from 'react'; // Added React import
import ResourcePanel from './ResourcePanel';
import MachineLayer from './layers/MachineLayer';
import AssemblyLayer from './layers/AssemblyLayer';
import HighLevelLayer from './layers/HighLevelLayer';
import ConcurrencyLayer from './layers/ConcurrencyLayer';
import AILayer from './layers/AILayer';
import UpgradePanel from './UpgradePanel';
import PrestigePanel, { getMetaBuffUpgradeCost } from './PrestigePanel';
import { 
  type GameState, initialGameState, GAME_LOOP_INTERVAL_MS, MAX_ENTROPY,
  ENTROPY_PER_PROCESS_PER_SEC, OPTIMIZATION_ENTROPY_REDUCTION_PER_LEVEL,
  calculateActualMaxMemory, calculateEffectiveTickRate, calculateMaxThreads,
  type UpgradeCosts, type MetaKnowledge, type LayerBuff, type ActiveLayerBuffs,
  CODE_COST_ASSEMBLY_PER_CHAR, CODE_COST_HIGHLEVEL_PER_CHAR,
  BASE_TICK_RATE_PER_CPU_LEVEL, AI_CORE_TICK_RATE_PER_LEVEL,
  type ThreadState, type GlobalConcurrencyLocks, type LayerSpecificStates // Added types
} from '../types/gameState';

const STORAGE_KEY = 'synthesis_game_state_v2.2'; // Incremented version

interface Toast { id: number; message: string; type: 'success' | 'error' | 'info'; }

const Game = () => {
  const [gameState, setGameState] = useState<GameState>(() => {
    const savedState = localStorage.getItem(STORAGE_KEY);
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState) as Partial<GameState>;
        let needsSave = false;

        // Ensure all top-level keys from initialGameState exist
        (Object.keys(initialGameState) as Array<keyof GameState>).forEach(key => {
          if (parsed[key] === undefined) {
            (parsed as any)[key] = initialGameState[key];
            needsSave = true;
          }
        });
        
        // Deep check and merge for layerSpecificStates
        if (!parsed.layerSpecificStates || typeof parsed.layerSpecificStates !== 'object') {
            parsed.layerSpecificStates = { ...initialGameState.layerSpecificStates };
            needsSave = true;
        } else {
            const initialLS = initialGameState.layerSpecificStates;
            const parsedLS = parsed.layerSpecificStates;
            (Object.keys(initialLS) as Array<keyof LayerSpecificStates>).forEach(lsKey => {
                if (parsedLS[lsKey] === undefined) {
                    (parsedLS as any)[lsKey] = initialLS[lsKey];
                    needsSave = true;
                }
                if (lsKey === 'concurrencyThreads' && !Array.isArray(parsedLS[lsKey])) {
                    parsedLS.concurrencyThreads = [...initialLS.concurrencyThreads];
                    needsSave = true;
                }
                 if (lsKey === 'concurrencyGlobalLocks' && typeof parsedLS[lsKey] !== 'object') {
                    parsedLS.concurrencyGlobalLocks = {...initialLS.concurrencyGlobalLocks};
                    needsSave = true;
                }
            });
        }

        // Deep check for metaKnowledge.buffs
        if (!parsed.metaKnowledge || typeof parsed.metaKnowledge.buffs !== 'object') {
            parsed.metaKnowledge = { ...initialGameState.metaKnowledge };
            needsSave = true;
        } else {
            const initialBuffs = initialGameState.metaKnowledge.buffs;
            const parsedBuffs = parsed.metaKnowledge.buffs;
            (Object.keys(initialBuffs) as Array<keyof MetaKnowledge['buffs']>).forEach(bKey => {
                if (parsedBuffs[bKey] === undefined) {
                    (parsedBuffs as any)[bKey] = initialBuffs[bKey];
                    needsSave = true;
                }
            });
        }
        
        // Similar deep checks for upgrades and upgradeCosts
        ['upgrades', 'upgradeCosts'].forEach(objKeyStr => {
            const objKey = objKeyStr as 'upgrades' | 'upgradeCosts';
            if (!parsed[objKey] || typeof parsed[objKey] !== 'object') {
                (parsed as any)[objKey] = { ...initialGameState[objKey] };
                needsSave = true;
            } else {
                const initialSubObj = initialGameState[objKey];
                const parsedSubObj = parsed[objKey] as any; // Type assertion for sub-object
                 (Object.keys(initialSubObj) as Array<keyof typeof initialSubObj>).forEach(subKey => {
                    if (parsedSubObj[subKey] === undefined) {
                        parsedSubObj[subKey] = initialSubObj[subKey];
                        needsSave = true;
                    }
                });
            }
        });


        if (needsSave) {
            console.log("Migrated old save data structure for", STORAGE_KEY);
            // localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed as GameState)); // Optionally re-save immediately
        }
        return parsed as GameState;
      } catch (error) {
        console.error(`Failed to parse saved game state (${STORAGE_KEY}):`, error);
        localStorage.removeItem(STORAGE_KEY); 
        return initialGameState;
      }
    }
    return initialGameState;
  });
  
  const [activeTab, setActiveTab] = useState('machine');
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const newToast = { id: Date.now(), message, type };
    setToasts(prev => {
        const updatedToasts = [...prev, newToast];
        return updatedToasts.length > 5 ? updatedToasts.slice(updatedToasts.length - 5) : updatedToasts;
    });
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== newToast.id));
    }, 3000 + (type === 'error' ? 1000 : 0));
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({...gameState, lastSaveTime: Date.now()}));
  }, [gameState]);

  // Main game loop (remains largely the same)
  useEffect(() => {
    const gameLoop = setInterval(() => {
      setGameState(prev => {
        const now = Date.now();
        const effectiveCpuTickRate = (BASE_TICK_RATE_PER_CPU_LEVEL * prev.upgrades.cpuLevel) * prev.metaKnowledge.buffs.tickMultiplier;
        const effectiveAiTickRate = (AI_CORE_TICK_RATE_PER_LEVEL * prev.upgrades.aiCoreLevel) * prev.metaKnowledge.buffs.tickMultiplier;
        const entropyFactor = 1 - (prev.resources.entropy / (MAX_ENTROPY * 2));
        
        const actualCpuTicksPerInterval = Math.max(0, (effectiveCpuTickRate * entropyFactor) / (1000 / GAME_LOOP_INTERVAL_MS));
        const actualAiTicksPerInterval = Math.max(0, (effectiveAiTickRate * entropyFactor) / (1000 / GAME_LOOP_INTERVAL_MS));
        const totalPassiveTicksThisInterval = actualCpuTicksPerInterval + actualAiTicksPerInterval;
        
        let newTicks = prev.resources.ticks + totalPassiveTicksThisInterval;
        let newAiAutoGenerated = prev.resources.aiAutoGeneratedTicks + actualAiTicksPerInterval;
        
        // Calculate activeProcesses based on running threads for more accuracy if Concurrency is a major factor
        const runningThreadsCount = prev.layerSpecificStates.concurrencyThreads.filter(t => t.status === 'running').length;
        const nonThreadProcesses = prev.activeProcesses - prev.layerSpecificStates.concurrencyThreads.filter(t => t.status !== 'idle').length; // Approximation
        const currentActiveProcesses = Math.max(0, nonThreadProcesses) + runningThreadsCount;


        const baseEntropyGain = currentActiveProcesses * (ENTROPY_PER_PROCESS_PER_SEC / (1000 / GAME_LOOP_INTERVAL_MS));
        const optimizationEffect = prev.upgrades.optimizationLevel * OPTIMIZATION_ENTROPY_REDUCTION_PER_LEVEL * prev.metaKnowledge.buffs.entropyReductionMultiplier;
        const entropyGain = Math.max(0, baseEntropyGain - optimizationEffect);
        const newEntropy = Math.min(MAX_ENTROPY, Math.max(0, prev.resources.entropy + entropyGain));

        const newActiveLayerBuffs: ActiveLayerBuffs = { ...prev.activeLayerBuffs };
        (Object.keys(newActiveLayerBuffs) as Array<keyof ActiveLayerBuffs>).forEach(layerKey => {
          const buff = newActiveLayerBuffs[layerKey];
          if (buff && buff.isActive && now >= buff.expiresAt) {
            newActiveLayerBuffs[layerKey] = null; 
            addToast(`Buff for ${layerKey} layer expired.`, 'info');
          }
        });
        
        return {
          ...prev,
          resources: {
            ...prev.resources,
            ticks: newTicks,
            entropy: newEntropy,
            aiAutoGeneratedTicks: newAiAutoGenerated,
          },
          activeProcesses: currentActiveProcesses, // Update active processes based on threads too
          totalTicksGeneratedAllTime: prev.totalTicksGeneratedAllTime + totalPassiveTicksThisInterval,
          activeLayerBuffs: newActiveLayerBuffs,
        };
      });
    }, GAME_LOOP_INTERVAL_MS);
    return () => clearInterval(gameLoop);
  }, [addToast]);

  // Auto Tick for Machine Layer (remains largely the same)
   useEffect(() => {
    let autoTickInterval: NodeJS.Timeout | null = null;
    if (gameState.autoTickEnabled) {
      const effectiveRateForManualAutoTick = calculateEffectiveTickRate(gameState);
      if (effectiveRateForManualAutoTick > 0.1) { 
        autoTickInterval = setInterval(() => {
           setGameState(prev => ({
            ...prev,
            resources: { ...prev.resources, ticks: prev.resources.ticks + 1 },
            totalTicksGeneratedAllTime: prev.totalTicksGeneratedAllTime + 1,
          }));
        }, Math.max(100, 1000 / effectiveRateForManualAutoTick)); 
      }
    }
    return () => {
      if (autoTickInterval) clearInterval(autoTickInterval);
    };
  }, [gameState.autoTickEnabled, gameState]); // gameState dependency for effective rate calculation


  // Callbacks for layer state changes
  const handleAssemblyCodeChange = useCallback((newCode: string) => {
    setGameState(prev => ({ ...prev, layerSpecificStates: { ...prev.layerSpecificStates, assemblyCode: newCode } }));
  }, []);
  const handleAssemblyOutputSet = useCallback((newOutput: string) => {
    setGameState(prev => ({ ...prev, layerSpecificStates: { ...prev.layerSpecificStates, assemblyOutput: newOutput } }));
  }, []);
  const handleHighLevelCodeChange = useCallback((newCode: string) => {
    setGameState(prev => ({ ...prev, layerSpecificStates: { ...prev.layerSpecificStates, highLevelCode: newCode } }));
  }, []);
  const handleHighLevelOutputSet = useCallback((newOutput: string) => {
    setGameState(prev => ({ ...prev, layerSpecificStates: { ...prev.layerSpecificStates, highLevelOutput: newOutput } }));
  }, []);
  const handleConcurrencyThreadsChange = useCallback((updater: (prevThreads: ThreadState[]) => ThreadState[]) => {
    setGameState(prev => ({ ...prev, layerSpecificStates: { ...prev.layerSpecificStates, concurrencyThreads: updater(prev.layerSpecificStates.concurrencyThreads) } }));
  }, []);
  const handleConcurrencyGlobalLocksChange = useCallback((updater: (prevLocks: GlobalConcurrencyLocks) => GlobalConcurrencyLocks) => {
    setGameState(prev => ({ ...prev, layerSpecificStates: { ...prev.layerSpecificStates, concurrencyGlobalLocks: updater(prev.layerSpecificStates.concurrencyGlobalLocks) } }));
  }, []);

  // produceTickManually, toggleAutoTick, buyUpgrade (remain the same)
  const produceTickManually = useCallback(() => {
    setGameState(prev => ({
      ...prev,
      resources: { ...prev.resources, ticks: prev.resources.ticks + 1 },
      totalTicksGeneratedAllTime: prev.totalTicksGeneratedAllTime + 1,
    }));
  }, []);

  const toggleAutoTick = useCallback(() => {
    setGameState(prev => ({ ...prev, autoTickEnabled: !prev.autoTickEnabled }));
  }, []);

  const buyUpgrade = useCallback((upgradeKey: keyof UpgradeCosts, costOnClick: number) => {
    setGameState(prev => {
      // Verify cost again with current state, in case of rapid clicks or state changes
      // The costOnClick is what the user saw, but we should recalculate based on current state for safety
      const currentBaseCost = prev.upgradeCosts[upgradeKey]; // This is the current cost for the *next* level
      const actualCurrentCost = Math.floor(currentBaseCost * prev.metaKnowledge.buffs.costMultiplier);

      // console.log(`Attempting to buy ${upgradeKey}. Ticks: ${prev.resources.ticks}, Cost (seen by user): ${costOnClick}, Cost (recalculated): ${actualCurrentCost}`);

      if (prev.resources.ticks < actualCurrentCost) {
        // Check if the cost seen by user was different, could indicate a rapid state change issue
        if (costOnClick !== actualCurrentCost) {
             addToast("Cost changed, please try again.", "error");
        } else {
            addToast("Not enough Ticks for this upgrade.", "error");
        }
        return prev;
      }
      
      const newState = JSON.parse(JSON.stringify(prev)) as GameState;
      newState.resources.ticks -= actualCurrentCost; // Deduct the recalculated actual cost
      
      let upgradeNameForToast = "";
      let newLevelForToast: number | undefined;

      // Base costs from initialGameState (or a separate constant map if preferred)
      // These are the costs for upgrading FROM level 0 to 1, or 1 to 2, etc.
      // The `initialGameState.upgradeCosts` represents the cost for the *first* upgrade of that type.
      // So, when we upgrade, we calculate the cost for the *next* level.

      switch (upgradeKey) {
        case 'cpu':
          newState.upgrades.cpuLevel += 1;
          // Cost for the *next* upgrade of CPU:
          newState.upgradeCosts.cpu = Math.floor(initialGameState.upgradeCosts.cpu * Math.pow(1.6, newState.upgrades.cpuLevel - initialGameState.upgrades.cpuLevel +1)); 
          // The +1 in Math.pow exponent is because initialGameState.upgrades.cpuLevel is 1, 
          // and initialGameState.upgradeCosts.cpu is cost for level 1->2.
          // A more robust way:
          // Cost for level N = BaseCostForLevel1 * (multiplier ^ (N-1))
          // So, cost for (newState.upgrades.cpuLevel + 1)
          newState.upgradeCosts.cpu = Math.floor(initialGameState.upgradeCosts.cpu * Math.pow(1.6, newState.upgrades.cpuLevel)); // If initialCosts.cpu is cost for L1->L2 & initialUpgrades.cpu is L1

          upgradeNameForToast = "CPU Core Clock";
          newLevelForToast = newState.upgrades.cpuLevel;
          break;
        case 'memory':
          newState.upgrades.memoryLevel += 1;
          newState.upgradeCosts.memory = Math.floor(initialGameState.upgradeCosts.memory * Math.pow(1.8, newState.upgrades.memoryLevel));
          upgradeNameForToast = "Memory Capacity";
          newLevelForToast = newState.upgrades.memoryLevel;
          break;
        case 'optimization':
          newState.upgrades.optimizationLevel += 1;
          newState.upgradeCosts.optimization = Math.floor(initialGameState.upgradeCosts.optimization * Math.pow(2.2, newState.upgrades.optimizationLevel)); // Opt level starts at 0
          upgradeNameForToast = "System Optimization";
          newLevelForToast = newState.upgrades.optimizationLevel;
          break;
        case 'aiCore':
          newState.upgrades.aiCoreLevel += 1;
          newState.upgradeCosts.aiCore = Math.floor(initialGameState.upgradeCosts.aiCore * Math.pow(1.9, newState.upgrades.aiCoreLevel)); // AI level starts at 0
          upgradeNameForToast = "AI Computation Cores";
          newLevelForToast = newState.upgrades.aiCoreLevel;
          break;
        case 'maxThreads':
          newState.upgrades.maxThreadsLevel +=1;
          newState.upgradeCosts.maxThreads = Math.floor(initialGameState.upgradeCosts.maxThreads * Math.pow(2.5, newState.upgrades.maxThreadsLevel));
          upgradeNameForToast = "Thread Scheduler";
          newLevelForToast = newState.upgrades.maxThreadsLevel;
          break;
        default:
          console.error("Unknown upgrade key in buyUpgrade:", upgradeKey);
          addToast("Error processing upgrade.", "error");
          return prev;
      }
      
      if (upgradeNameForToast && newLevelForToast !== undefined) {
          addToast(`${upgradeNameForToast} upgraded to Level ${newLevelForToast}!`, 'success');
      } else {
          addToast(`Upgrade successful!`, 'success'); // Fallback toast
      }
      return newState;
    });
  }, [addToast]);


  // runCode adjusted to use persisted code for Assembly/HLL
  const runCode = useCallback((codeFromLayer: string, layer: string, threadId?: number): { success: boolean; ticksGenerated: number } => {
    let codeToRun: string;
    switch (layer) {
        case 'assembly': codeToRun = gameState.layerSpecificStates.assemblyCode; break;
        case 'highLevel': codeToRun = gameState.layerSpecificStates.highLevelCode; break;
        default: codeToRun = codeFromLayer; // For concurrency, codeFromLayer is thread-specific
    }

    let currentCodeCost = 0;
    if (layer === 'assembly') currentCodeCost = codeToRun.length * CODE_COST_ASSEMBLY_PER_CHAR;
    else if (layer === 'highLevel' || layer === 'concurrency') currentCodeCost = codeToRun.length * CODE_COST_HIGHLEVEL_PER_CHAR;

    const complexity = codeToRun.length / (layer === 'assembly' ? 50 : 25); 
    const baseSuccessChance = 0.95; 
    const successChance = Math.max(0.1, baseSuccessChance - (complexity * 0.02));
    const success = Math.random() < successChance;
    
    const buff = gameState.activeLayerBuffs[layer as keyof ActiveLayerBuffs];
    const buffMultiplier = (buff && buff.isActive) ? buff.effectMultiplier : 1.0;

    let ticksGenerated = 0;
    let entropyChange = 0;

    if (success) {
      const layerMultiplier = layer === 'assembly' ? 1.5 : layer === 'concurrency' ? 3.0 : 2.5;
      ticksGenerated = Math.floor( (5 + complexity * 2) * layerMultiplier * buffMultiplier * gameState.metaKnowledge.buffs.tickMultiplier );
      entropyChange = complexity * 0.05;
    } else {
      ticksGenerated = Math.floor( (1 + complexity * 0.5) * buffMultiplier );
      entropyChange = complexity * 0.25;
    }
    
    setGameState(prev => {
      let newActiveProcesses = prev.activeProcesses;
      if (success && layer !== 'concurrency') { // Concurrency layer manages its own "process" count via thread statuses
          newActiveProcesses += 1;
      }
      const cappedActiveProcesses = Math.min(newActiveProcesses, 50 + prev.upgrades.cpuLevel * 5);
      const newUsedMemory = Math.min(calculateActualMaxMemory(prev), prev.resources.usedMemory + currentCodeCost);

      return {
        ...prev,
        resources: {
          ...prev.resources,
          ticks: prev.resources.ticks + ticksGenerated,
          entropy: Math.min(MAX_ENTROPY, Math.max(0, prev.resources.entropy + entropyChange)),
          usedMemory: newUsedMemory,
        },
        activeProcesses: cappedActiveProcesses,
        totalTicksGeneratedAllTime: prev.totalTicksGeneratedAllTime + ticksGenerated,
      };
    });

    // Auto-decrement for non-concurrent successful processes
    if (success && layer !== 'concurrency') { 
      setTimeout(() => {
        setGameState(prev => ({
          ...prev, 
          activeProcesses: Math.max(0, prev.activeProcesses - 1),
          resources: {
            ...prev.resources, 
            usedMemory: Math.max(0, prev.resources.usedMemory - currentCodeCost)
          }
        }));
      }, 5000 + Math.random() * 5000);
    }
    return { success, ticksGenerated };
  }, [gameState.layerSpecificStates, gameState.activeLayerBuffs, gameState.metaKnowledge.buffs.tickMultiplier, gameState.upgrades.cpuLevel, addToast]);


  // runUnitTests, garbageCollect, Prestige logic (remain the same, ensure addToast is used)
  const runUnitTests = useCallback((layer: string) => { /* ... (addToast for feedback) */ }, [gameState.resources.ticks, addToast]);
  const garbageCollect = useCallback(() => { /* ... (addToast for feedback) */ }, [gameState.resources.ticks, gameState.metaKnowledge.buffs, addToast]);
  const calculateMkGain = useCallback((): number => { /* ... */ }, [gameState.totalTicksGeneratedAllTime, gameState.upgrades]);
  const handlePrestige = useCallback(() => { /* ... (addToast for feedback) */ }, [gameState.metaKnowledge, gameState.autoTickEnabled, calculateMkGain, addToast]);
  const spendMetaKnowledge = useCallback((buffKey: keyof MetaKnowledge['buffs']) => {
    setGameState(prev => {
      const currentBuffValue = prev.metaKnowledge.buffs[buffKey];
      const cost = getMetaBuffUpgradeCost(buffKey, currentBuffValue); // Use the imported helper

      if (prev.metaKnowledge.points < cost) {
        addToast("Not enough Meta-Knowledge points.", 'error');
        return prev;
      }
      // Check for max cost reduction (0.5 is 50% reduction)
      const isMaxCostReduction = buffKey === 'costMultiplier' && currentBuffValue <= 0.501; // Use a small epsilon for float comparison
      if (isMaxCostReduction) {
         addToast("Maximum cost reduction reached for this buff.", "info");
         return prev;
      }

      const newMetaKnowledge = JSON.parse(JSON.stringify(prev.metaKnowledge)) as MetaKnowledge;
      newMetaKnowledge.points -= cost;
      
      let buffName = "";
      // Apply the buff increment
      switch (buffKey) {
        case 'tickMultiplier': 
          newMetaKnowledge.buffs.tickMultiplier += 0.05; 
          buffName = "Tick Multiplier"; 
          break;
        case 'costMultiplier': 
          // Ensure it doesn't go below 0.5
          newMetaKnowledge.buffs.costMultiplier = Math.max(0.5, newMetaKnowledge.buffs.costMultiplier - 0.02); 
          buffName = "Cost Reduction"; 
          break;
        case 'entropyReductionMultiplier': 
          newMetaKnowledge.buffs.entropyReductionMultiplier += 0.05; 
          buffName = "Entropy Reduction"; 
          break;
        case 'memoryMultiplier': 
          newMetaKnowledge.buffs.memoryMultiplier += 0.05; 
          buffName = "Memory Multiplier"; 
          break;
      }

      // Round to prevent floating point display issues
      newMetaKnowledge.buffs.tickMultiplier = parseFloat(newMetaKnowledge.buffs.tickMultiplier.toFixed(3));
      newMetaKnowledge.buffs.costMultiplier = parseFloat(newMetaKnowledge.buffs.costMultiplier.toFixed(3));
      newMetaKnowledge.buffs.entropyReductionMultiplier = parseFloat(newMetaKnowledge.buffs.entropyReductionMultiplier.toFixed(3));
      newMetaKnowledge.buffs.memoryMultiplier = parseFloat(newMetaKnowledge.buffs.memoryMultiplier.toFixed(3));

      addToast(`${buffName} buff improved!`, 'success');
      return { ...prev, metaKnowledge: newMetaKnowledge };
    });
  }, [addToast]);

  const tabs = [
    { key: 'machine', label: 'Machine Core', component: <MachineLayer gameState={gameState} produceTickManually={produceTickManually} toggleAutoTick={toggleAutoTick} /> },
    { key: 'assembly', label: 'Assembly', component: <AssemblyLayer gameState={gameState} runCode={runCode} runUnitTests={runUnitTests} onCodeChange={handleAssemblyCodeChange} onOutputSet={handleAssemblyOutputSet}/> },
    { key: 'highLevel', label: 'High-Level', component: <HighLevelLayer gameState={gameState} runCode={runCode} runUnitTests={runUnitTests} onCodeChange={handleHighLevelCodeChange} onOutputSet={handleHighLevelOutputSet}/> },
    { key: 'concurrency', label: 'Concurrency', component: <ConcurrencyLayer gameState={gameState} runCode={runCode} onThreadsChange={handleConcurrencyThreadsChange} onGlobalLocksChange={handleConcurrencyGlobalLocksChange} /> },
    { key: 'ai', label: 'AI Subsystem', component: <AILayer gameState={gameState} /> },
    { key: 'prestige', label: 'Prestige', component: <PrestigePanel gameState={gameState} onPrestige={handlePrestige} onSpendMetaKnowledge={spendMetaKnowledge} calculateMkGain={calculateMkGain} /> },
  ];

  return (
    <>
      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-50 space-y-2 w-auto max-w-sm">
        {toasts.map(toast => (
          <div key={toast.id} className={`p-3 rounded-md shadow-lg text-sm font-medium animate-fadeIn ${
            toast.type === 'success' ? 'bg-green-600 text-white' : 
            toast.type === 'error' ? 'bg-red-600 text-white' :
            'bg-blue-600 text-white' 
          } border ${toast.type === 'success' ? 'border-green-700' : toast.type === 'error' ? 'border-red-700' : 'border-blue-700'}`}>
            {toast.message}
          </div>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">
        <div className="lg:w-1/3 xl:w-1/4 flex flex-col space-y-4 sm:space-y-6">
          <ResourcePanel gameState={gameState} />
          <UpgradePanel gameState={gameState} buyUpgrade={buyUpgrade} />
          <button
            onClick={garbageCollect}
            disabled={gameState.resources.ticks < Math.floor(10 * gameState.metaKnowledge.buffs.costMultiplier)}
            title={gameState.resources.ticks < Math.floor(10 * gameState.metaKnowledge.buffs.costMultiplier) ? "Not enough Ticks" : `Cost: ${Math.floor(10 * gameState.metaKnowledge.buffs.costMultiplier)} Ticks`}
            className="w-full px-4 py-3 rounded font-semibold bg-yellow-500 hover:bg-yellow-600 text-black disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150"
          >
            Garbage Collection
          </button>
        </div>
        
        <div className="lg:w-2/3 xl:w-3/4 bg-background-secondary rounded-md border border-border-primary shadow-lg p-4 sm:p-6 min-h-[calc(100vh-200px)]">
          <div className="flex flex-wrap border-b border-border-secondary mb-4 sm:mb-6 -mx-2 sm:-mx-4">
            {tabs.map((tabInfo) => (
              <button 
                key={tabInfo.key}
                onClick={() => setActiveTab(tabInfo.key)}
                className={`px-3 sm:px-4 py-2 text-sm sm:text-base transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-opacity-50 ${
                  activeTab === tabInfo.key 
                    ? 'text-accent-primary border-b-2 border-accent-primary font-semibold focus:ring-accent-primary' 
                    : 'text-text-secondary hover:text-text-primary focus:ring-accent-secondary'
                }`}
              >
                {tabInfo.label}
              </button>
            ))}
          </div>
          
          {/* Render the active tab's component */}
          {tabs.find(tabInfo => tabInfo.key === activeTab)?.component}

        </div>
      </div>
    </>
  );
};

export default Game;