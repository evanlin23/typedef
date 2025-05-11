import { useState, useEffect, useCallback } from 'react';
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
  calculateActualMaxMemory, calculateEffectiveTickRate,
  type UpgradeCosts, type MetaKnowledge, type LayerBuff, type ActiveLayerBuffs,
  CODE_COST_ASSEMBLY_PER_CHAR, CODE_COST_HIGHLEVEL_PER_CHAR,
  BASE_TICK_RATE_PER_CPU_LEVEL, AI_CORE_TICK_RATE_PER_LEVEL,
  type ThreadState, type GlobalConcurrencyLocks, type LayerSpecificStates
} from '../types/gameState';

const STORAGE_KEY = 'synthesis_game_state_v2.4'; // Increment version for significant structure changes

interface Toast { id: number; message: string; type: 'success' | 'error' | 'info'; }

// Helper to deep merge saved state with initial state, ensuring all keys exist
const mergeWithInitialState = (parsed: Partial<GameState>): GameState => {
  let needsSave = false;
  const mergedState = { ...initialGameState, ...parsed };

  // Ensure all top-level keys from initialGameState exist
  (Object.keys(initialGameState) as Array<keyof GameState>).forEach(key => {
    if (mergedState[key] === undefined) {
      (mergedState as any)[key] = initialGameState[key];
      needsSave = true;
    }
  });

  // Deep check and merge for layerSpecificStates
  if (!parsed.layerSpecificStates || typeof parsed.layerSpecificStates !== 'object' || parsed.layerSpecificStates === null) {
    mergedState.layerSpecificStates = { ...initialGameState.layerSpecificStates };
    needsSave = true;
  } else {
    const initialLS = initialGameState.layerSpecificStates;
    const parsedLS = mergedState.layerSpecificStates; // Use mergedState here
    (Object.keys(initialLS) as Array<keyof LayerSpecificStates>).forEach(lsKey => {
      if (parsedLS[lsKey] === undefined) {
        (parsedLS as any)[lsKey] = initialLS[lsKey];
        needsSave = true;
      }
      if (lsKey === 'concurrencyThreads' && !Array.isArray(parsedLS.concurrencyThreads)) {
        parsedLS.concurrencyThreads = [...initialLS.concurrencyThreads];
        needsSave = true;
      }
      if (lsKey === 'concurrencyGlobalLocks' && (typeof parsedLS.concurrencyGlobalLocks !== 'object' || parsedLS.concurrencyGlobalLocks === null)) {
        parsedLS.concurrencyGlobalLocks = { ...initialLS.concurrencyGlobalLocks };
        needsSave = true;
      }
    });
  }

  // Deep check for metaKnowledge and its buffs
  if (!parsed.metaKnowledge || typeof parsed.metaKnowledge !== 'object' || parsed.metaKnowledge === null) {
    mergedState.metaKnowledge = { ...initialGameState.metaKnowledge };
    needsSave = true;
  } else {
    mergedState.metaKnowledge = { ...initialGameState.metaKnowledge, ...parsed.metaKnowledge };
    if (!parsed.metaKnowledge.buffs || typeof parsed.metaKnowledge.buffs !== 'object' || parsed.metaKnowledge.buffs === null) {
      mergedState.metaKnowledge.buffs = { ...initialGameState.metaKnowledge.buffs };
      needsSave = true;
    } else {
      mergedState.metaKnowledge.buffs = { ...initialGameState.metaKnowledge.buffs, ...parsed.metaKnowledge.buffs };
      const initialBuffs = initialGameState.metaKnowledge.buffs;
      const parsedBuffs = mergedState.metaKnowledge.buffs;
      (Object.keys(initialBuffs) as Array<keyof MetaKnowledge['buffs']>).forEach(bKey => {
        if (parsedBuffs[bKey] === undefined) {
          (parsedBuffs as any)[bKey] = initialBuffs[bKey];
          needsSave = true;
        }
      });
    }
  }
  
  // Deep checks for upgrades and upgradeCosts
  ['upgrades', 'upgradeCosts'].forEach(objKeyStr => {
    const objKey = objKeyStr as 'upgrades' | 'upgradeCosts';
    if (!parsed[objKey] || typeof parsed[objKey] !== 'object' || parsed[objKey] === null) {
      (mergedState as any)[objKey] = { ...initialGameState[objKey] };
      needsSave = true;
    } else {
      (mergedState as any)[objKey] = { ...initialGameState[objKey], ...(parsed[objKey] as any) };
      const initialSubObj = initialGameState[objKey];
      const parsedSubObj = mergedState[objKey] as any;
      (Object.keys(initialSubObj) as Array<keyof typeof initialSubObj>).forEach(subKey => {
        if (parsedSubObj[subKey] === undefined) {
          parsedSubObj[subKey] = initialSubObj[subKey];
          needsSave = true;
        }
      });
    }
  });

  if (needsSave) {
    console.log("Migrated or initialized parts of old save data structure for key:", STORAGE_KEY);
  }
  return mergedState as GameState; // Cast to GameState as we've ensured all parts are present
};


const Game = () => {
  const [gameState, setGameState] = useState<GameState>(() => {
    const savedState = localStorage.getItem(STORAGE_KEY);
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState) as Partial<GameState>;
        return mergeWithInitialState(parsed);
      } catch (error) {
        console.error(`Failed to parse saved game state (${STORAGE_KEY}). Resetting to initial state. Error:`, error);
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
    setToasts(prevToasts => {
        const updatedToasts = [...prevToasts, newToast];
        // Limit to max 5 toasts
        return updatedToasts.length > 5 ? updatedToasts.slice(updatedToasts.length - 5) : updatedToasts;
    });
    // Auto-dismiss toast
    setTimeout(() => {
      setToasts(prevToasts => prevToasts.filter(t => t.id !== newToast.id));
    }, 3000 + (type === 'error' ? 1000 : 0)); // Longer display for errors
  }, []); // Empty dependency array as it doesn't depend on component state/props

  // Save game state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({...gameState, lastSaveTime: Date.now()}));
  }, [gameState]);

  // Main Game Loop for passive generation and entropy
  useEffect(() => {
    const gameLoop = setInterval(() => {
      setGameState(prev => {
        const now = Date.now();
        
        // Passive tick generation (CPU & AI)
        const metaTickMultiplier = prev.metaKnowledge.buffs.tickMultiplier;
        const entropyFactor = 1 - (prev.resources.entropy / (MAX_ENTROPY * 2)); // Max 50% reduction

        const cpuBaseRate = BASE_TICK_RATE_PER_CPU_LEVEL * prev.upgrades.cpuLevel;
        const aiBaseRate = AI_CORE_TICK_RATE_PER_LEVEL * prev.upgrades.aiCoreLevel;

        const effectiveCpuTicksPerSec = cpuBaseRate * metaTickMultiplier * entropyFactor;
        const effectiveAiTicksPerSec = aiBaseRate * metaTickMultiplier * entropyFactor;
        
        const ticksFromCpuThisInterval = Math.max(0, effectiveCpuTicksPerSec / (1000 / GAME_LOOP_INTERVAL_MS));
        const ticksFromAiThisInterval = Math.max(0, effectiveAiTicksPerSec / (1000 / GAME_LOOP_INTERVAL_MS));
        const totalPassiveTicksThisInterval = ticksFromCpuThisInterval + ticksFromAiThisInterval;
        
        let newTicks = prev.resources.ticks + totalPassiveTicksThisInterval;
        let newAiAutoGenerated = prev.resources.aiAutoGeneratedTicks + ticksFromAiThisInterval;
        
        // Entropy calculation
        const runningThreadsCount = prev.layerSpecificStates.concurrencyThreads.filter(t => t.status === 'running').length;
        // prev.activeProcesses tracks non-concurrent processes. Total processes for entropy = non-concurrent + running threads.
        const totalProcessesForEntropy = prev.activeProcesses + runningThreadsCount;

        const baseEntropyGainPerSec = totalProcessesForEntropy * ENTROPY_PER_PROCESS_PER_SEC;
        const entropyReductionPerSec = prev.upgrades.optimizationLevel * OPTIMIZATION_ENTROPY_REDUCTION_PER_LEVEL * prev.metaKnowledge.buffs.entropyReductionMultiplier;
        
        const netEntropyGainPerSec = Math.max(0, baseEntropyGainPerSec - entropyReductionPerSec);
        const entropyGainThisInterval = netEntropyGainPerSec / (1000 / GAME_LOOP_INTERVAL_MS);
        const newEntropy = Math.min(MAX_ENTROPY, Math.max(0, prev.resources.entropy + entropyGainThisInterval));

        // Active layer buff expiry
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
          // prev.activeProcesses is managed by runCode timeouts for non-concurrent tasks, so it's not changed here.
          activeProcesses: prev.activeProcesses, 
          totalTicksGeneratedAllTime: prev.totalTicksGeneratedAllTime + totalPassiveTicksThisInterval,
          activeLayerBuffs: newActiveLayerBuffs,
        };
      });
    }, GAME_LOOP_INTERVAL_MS);
    return () => clearInterval(gameLoop);
  }, [addToast]); // addToast is memoized

   // Auto-tick for Machine Layer (simulated manual clicks)
   useEffect(() => {
    let autoTickInterval: NodeJS.Timeout | null = null;
    if (gameState.autoTickEnabled) {
      const effectiveRateForManualAutoTick = calculateEffectiveTickRate(gameState);
      // Only start interval if rate is somewhat meaningful to avoid very frequent/meaningless intervals
      if (effectiveRateForManualAutoTick > 0.05) { 
        autoTickInterval = setInterval(() => {
           setGameState(prev => ({
            ...prev,
            resources: { ...prev.resources, ticks: prev.resources.ticks + 1 },
            totalTicksGeneratedAllTime: prev.totalTicksGeneratedAllTime + 1,
          }));
        }, Math.max(50, 1000 / effectiveRateForManualAutoTick)); // Ensure interval is not too small
      }
    }
    return () => {
      if (autoTickInterval) clearInterval(autoTickInterval);
    };
  }, [
    gameState.autoTickEnabled, 
    gameState.upgrades, // For calculateEffectiveTickRate
    gameState.resources.entropy, // For calculateEffectiveTickRate
    gameState.metaKnowledge.buffs.tickMultiplier // For calculateEffectiveTickRate
  ]);

  // Callbacks for updating layer-specific states
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
      const currentStoredBaseCostForNextLevel = prev.upgradeCosts[upgradeKey]; 
      const actualPaymentCost = Math.floor(currentStoredBaseCostForNextLevel * prev.metaKnowledge.buffs.costMultiplier);

      if (prev.resources.ticks < actualPaymentCost) {
        // If cost changed significantly since UI rendered it, inform user
        if (costOnClick !== actualPaymentCost && Math.abs(costOnClick - actualPaymentCost) > 1) {
             addToast("Upgrade cost has changed. Please try again.", "error");
        } else {
            addToast("Not enough Ticks for this upgrade.", "error");
        }
        return prev;
      }
      
      // Deep clone for safe modification of nested objects
      const newState = JSON.parse(JSON.stringify(prev)) as GameState;
      newState.resources.ticks -= actualPaymentCost;
      
      let upgradeNameForToast = "";
      let newLevelForToast: number | undefined;

      // Define cost multipliers locally for clarity
      const costMultipliers = {
        cpu: 1.5, memory: 1.6, optimization: 1.8, aiCore: 1.7, maxThreads: 2.0,
      };

      switch (upgradeKey) {
        case 'cpu':
          newState.upgrades.cpuLevel += 1;
          newState.upgradeCosts.cpu = Math.floor(currentStoredBaseCostForNextLevel * costMultipliers.cpu);
          upgradeNameForToast = "CPU Core Clock"; newLevelForToast = newState.upgrades.cpuLevel; break;
        case 'memory':
          newState.upgrades.memoryLevel += 1;
          newState.upgradeCosts.memory = Math.floor(currentStoredBaseCostForNextLevel * costMultipliers.memory);
          upgradeNameForToast = "Memory Capacity"; newLevelForToast = newState.upgrades.memoryLevel; break;
        case 'optimization':
          newState.upgrades.optimizationLevel += 1;
          newState.upgradeCosts.optimization = Math.floor(currentStoredBaseCostForNextLevel * costMultipliers.optimization);
          upgradeNameForToast = "System Optimization"; newLevelForToast = newState.upgrades.optimizationLevel; break;
        case 'aiCore':
          newState.upgrades.aiCoreLevel += 1;
          newState.upgradeCosts.aiCore = Math.floor(currentStoredBaseCostForNextLevel * costMultipliers.aiCore);
          upgradeNameForToast = "AI Computation Cores"; newLevelForToast = newState.upgrades.aiCoreLevel; break;
        case 'maxThreads':
          newState.upgrades.maxThreadsLevel +=1;
          newState.upgradeCosts.maxThreads = Math.floor(currentStoredBaseCostForNextLevel * costMultipliers.maxThreads);
          upgradeNameForToast = "Thread Scheduler"; newLevelForToast = newState.upgrades.maxThreadsLevel; break;
        default: 
          addToast("Error processing upgrade: Unknown upgrade key.", "error"); 
          console.error("Unknown upgrade key in buyUpgrade:", upgradeKey);
          return prev; // Return original state on error
      }
      
      if (upgradeNameForToast && newLevelForToast !== undefined) {
          addToast(`${upgradeNameForToast} upgraded to Level ${newLevelForToast}!`, 'success');
      }
      return newState;
    });
  }, [addToast]);

  const runCode = useCallback((codeFromLayer: string, layer: string, _threadId?: number): { success: boolean; ticksGenerated: number } => {
    // Code to run is determined by layer, primarily from gameState
    let codeToRun: string;
    switch (layer) {
        case 'assembly': codeToRun = gameState.layerSpecificStates.assemblyCode; break;
        case 'highLevel': codeToRun = gameState.layerSpecificStates.highLevelCode; break;
        default: codeToRun = codeFromLayer; // Concurrency uses thread-specific code
    }

    let currentCodeCost = 0;
    if (layer === 'assembly') currentCodeCost = codeToRun.length * CODE_COST_ASSEMBLY_PER_CHAR;
    else if (layer === 'highLevel' || layer === 'concurrency') currentCodeCost = codeToRun.length * CODE_COST_HIGHLEVEL_PER_CHAR;

    // Simulation parameters
    const complexity = codeToRun.length / (layer === 'assembly' ? 50 : 25); 
    const baseSuccessChance = 0.95; 
    const successChance = Math.max(0.1, baseSuccessChance - (complexity * 0.02)); // Higher complexity, lower success
    const success = Math.random() < successChance;
    
    const layerBuff = gameState.activeLayerBuffs[layer as keyof ActiveLayerBuffs];
    const buffMultiplier = (layerBuff && layerBuff.isActive) ? layerBuff.effectMultiplier : 1.0;

    let ticksGenerated = 0;
    let entropyChange = 0; // Entropy change from this specific code execution

    if (success) {
      const layerTickMultiplier = layer === 'assembly' ? 1.5 : layer === 'concurrency' ? 3.0 : 2.5;
      ticksGenerated = Math.floor( (5 + complexity * 2) * layerTickMultiplier * buffMultiplier * gameState.metaKnowledge.buffs.tickMultiplier );
      entropyChange = complexity * 0.05; // Successful runs generate less entropy
    } else {
      ticksGenerated = Math.floor( (1 + complexity * 0.5) * buffMultiplier ); // Failed runs generate fewer ticks
      entropyChange = complexity * 0.25; // Failed runs generate more entropy
    }
    
    setGameState(prev => {
      let newActiveProcesses = prev.activeProcesses;
      // For non-concurrent layers, successful execution starts a "process"
      if (success && layer !== 'concurrency') {
          newActiveProcesses += 1;
      }
      // Cap active processes to avoid runaway numbers, though this cap should ideally be very high or managed by game balance
      const cappedActiveProcesses = Math.min(newActiveProcesses, 50 + prev.upgrades.cpuLevel * 5); 
      const newUsedMemory = Math.min(calculateActualMaxMemory(prev), prev.resources.usedMemory + currentCodeCost);

      return {
        ...prev,
        resources: {
          ...prev.resources,
          ticks: prev.resources.ticks + ticksGenerated,
          // Entropy from code execution is added directly. The game loop handles passive entropy.
          entropy: Math.min(MAX_ENTROPY, Math.max(0, prev.resources.entropy + entropyChange)),
          usedMemory: newUsedMemory,
        },
        activeProcesses: cappedActiveProcesses, // This tracks non-concurrent processes
        totalTicksGeneratedAllTime: prev.totalTicksGeneratedAllTime + ticksGenerated,
      };
    });

    // Simulate non-concurrent process finishing and freeing resources
    if (success && layer !== 'concurrency') { 
      setTimeout(() => {
        setGameState(prev => ({
          ...prev, 
          activeProcesses: Math.max(0, prev.activeProcesses - 1), // Decrement non-concurrent process count
          resources: { 
            ...prev.resources, 
            usedMemory: Math.max(0, prev.resources.usedMemory - currentCodeCost) // Free memory
          }
        }));
      }, 5000 + Math.random() * 5000); // Random duration for process completion
    }
    return { success, ticksGenerated };
  }, [
    gameState.layerSpecificStates, 
    gameState.activeLayerBuffs, 
    gameState.metaKnowledge.buffs.tickMultiplier, 
    gameState.upgrades.cpuLevel,
    // No addToast here, UI layer handles output based on success/ticks
  ]);

  const runUnitTests = useCallback((layer: string) => {
    const testCosts = { assembly: 5, highLevel: 15, concurrency: 10 };
    const cost = testCosts[layer as keyof typeof testCosts] || 10;
    
    if (gameState.resources.ticks < cost) {
      addToast(`Not enough Ticks for ${layer} unit tests. Cost: ${cost} Ticks.`, 'error');
      return;
    }

    setGameState(prev => {
      // Re-check cost inside setGameState for safety, though unlikely to change if outer check passed
      if (prev.resources.ticks < cost) return prev; 
      
      const testSuccess = Math.random() < 0.7; // 70% chance of success
      let newActiveLayerBuffs = { ...prev.activeLayerBuffs };
      let newEntropy = prev.resources.entropy;

      if (testSuccess) {
        const buffDurationMs = 60 * 1000; // 1 minute
        const buffMultiplier = 1.2; // 20% boost
        const newBuff: LayerBuff = {
          id: `${layer}_test_buff_${Date.now()}`,
          isActive: true,
          expiresAt: Date.now() + buffDurationMs,
          effectMultiplier: buffMultiplier,
          description: `+20% tick output from ${layer} layer for 1 min.`
        };
        newActiveLayerBuffs[layer as keyof ActiveLayerBuffs] = newBuff;
        addToast(`Unit tests for ${layer} passed! Output boosted by 20% for 1 minute.`, 'success');
      } else {
        const entropyPenalty = layer === 'assembly' ? 3 : 5;
        newEntropy = Math.min(MAX_ENTROPY, prev.resources.entropy + entropyPenalty);
        addToast(`Unit tests for ${layer} found issues! Entropy increased by ${entropyPenalty}.`, 'error');
      }

      return {
        ...prev,
        resources: { 
          ...prev.resources, 
          ticks: Math.max(0, prev.resources.ticks - cost), // Deduct cost
          entropy: newEntropy 
        },
        activeLayerBuffs: newActiveLayerBuffs,
      };
    });
  }, [gameState.resources.ticks, addToast]);

  const garbageCollect = useCallback(() => {
    const baseCost = 10;
    const actualCost = Math.floor(baseCost * gameState.metaKnowledge.buffs.costMultiplier);

    if (gameState.resources.ticks < actualCost) {
        addToast(`Not enough Ticks for Garbage Collection. Cost: ${actualCost} Ticks.`, "error");
        return;
    }
    
    setGameState(prev => {
      // Re-check cost inside setGameState
      const currentActualCost = Math.floor(baseCost * prev.metaKnowledge.buffs.costMultiplier);
      if (prev.resources.ticks < currentActualCost) return prev; 

      const entropyReductionAmount = 20 * prev.metaKnowledge.buffs.entropyReductionMultiplier;
      // Reduce a quarter of non-thread (non-concurrent) active processes
      const activeProcessesToReduce = Math.floor(prev.activeProcesses * 0.25); 

      const newEntropy = Math.max(0, prev.resources.entropy - entropyReductionAmount);
      const newTicks = Math.max(0, prev.resources.ticks - currentActualCost);
      const newActiveProcesses = Math.max(0, prev.activeProcesses - activeProcessesToReduce);
      
      let toastMessage = 'Garbage Collection ran. ';
      if (newEntropy < prev.resources.entropy) {
          toastMessage += `Entropy reduced by up to ${entropyReductionAmount.toFixed(1)}. `;
      } else if (prev.resources.entropy > 0) {
          toastMessage += 'Entropy reduction hit 0. ';
      } else {
          toastMessage += 'No entropy to reduce. ';
      }
      if (newActiveProcesses < prev.activeProcesses) {
          toastMessage += `${prev.activeProcesses - newActiveProcesses} idle processes cleared.`;
      }
      addToast(toastMessage, 'info');

      return {
        ...prev,
        resources: { ...prev.resources, ticks: newTicks, entropy: newEntropy },
        activeProcesses: newActiveProcesses, // Update non-concurrent process count
      };
    });
  }, [
    gameState.resources.ticks, 
    gameState.metaKnowledge.buffs.costMultiplier, 
    gameState.metaKnowledge.buffs.entropyReductionMultiplier,
    gameState.activeProcesses, // Added as it's used in calculation for toast
    addToast
  ]);

  const calculateMkGain = useCallback((): number => {
    // MK gain is based on various progress markers
    const fromTicks = Math.floor(gameState.totalTicksGeneratedAllTime / 1_000_000);
    const fromCpu = Math.floor(gameState.upgrades.cpuLevel / 10);
    const fromMemory = Math.floor(gameState.upgrades.memoryLevel / 5);
    const fromAICores = Math.floor(gameState.upgrades.aiCoreLevel / 5);
    const fromOptimization = Math.floor(gameState.upgrades.optimizationLevel / 8);
    const fromThreads = Math.floor(gameState.upgrades.maxThreadsLevel / 3);

    // Require some baseline progress to start earning MK
    if (gameState.totalTicksGeneratedAllTime < 250_000 && 
        (gameState.upgrades.cpuLevel < 5 || gameState.upgrades.memoryLevel < 3)) {
        return 0;
    }
    const totalMk = fromTicks + fromCpu + fromMemory + fromAICores + fromOptimization + fromThreads;
    return Math.max(0, Math.floor(totalMk));
  }, [gameState.totalTicksGeneratedAllTime, gameState.upgrades]);

  const handlePrestige = useCallback(() => {
    const mkGained = calculateMkGain();
    const confirmMessage = mkGained < 1 
      ? "Your current progress yields 0 Meta-Knowledge. Are you sure you want to prestige? This will reset your game progress (except MK buffs)."
      : `Are you sure you want to prestige and gain ${mkGained} Meta-Knowledge? This will reset your current game progress (except MK buffs).`;

    if (!confirm(confirmMessage)) {
      addToast(mkGained < 1 ? "Prestige cancelled. Continue enhancing your system!" : "Prestige cancelled.", "info");
      return;
    }

    const preservedMetaKnowledge: MetaKnowledge = {
      ...gameState.metaKnowledge, // Preserves existing buffs
      points: gameState.metaKnowledge.points + mkGained,
    };
    const preservedAutoTick = gameState.autoTickEnabled; // Preserve auto-tick setting
    
    // Reset layer specific states to their initial values by creating a fresh copy
    const resetLayerStates: LayerSpecificStates = JSON.parse(JSON.stringify(initialGameState.layerSpecificStates));

    setGameState({
      ...initialGameState, // Base reset
      metaKnowledge: preservedMetaKnowledge,
      autoTickEnabled: preservedAutoTick,
      layerSpecificStates: resetLayerStates, 
      lastSaveTime: Date.now(), 
      // totalTicksGeneratedAllTime is reset by initialGameState spread
    });
    setActiveTab('machine'); // Go back to the first tab
    addToast(mkGained > 0 
      ? `Universe Recompiled! Gained ${mkGained} Meta-Knowledge. System rebooted with enhanced potential.`
      : `System Rebooted. No Meta-Knowledge gained this cycle. Strive for greater complexity!`, 
      mkGained > 0 ? 'success' : 'info');
  }, [
    gameState.metaKnowledge, 
    gameState.autoTickEnabled, 
    calculateMkGain, 
    addToast 
  ]);
  
  const spendMetaKnowledge = useCallback((buffKey: keyof MetaKnowledge['buffs']) => {
    setGameState(prev => {
      const currentBuffValue = prev.metaKnowledge.buffs[buffKey];
      const cost = getMetaBuffUpgradeCost(buffKey, currentBuffValue);

      if (prev.metaKnowledge.points < cost) {
        addToast("Not enough Meta-Knowledge points.", 'error');
        return prev;
      }
      // Specific cap for costMultiplier
      if (buffKey === 'costMultiplier' && currentBuffValue <= 0.501) { // 0.5 is 50% reduction
         addToast("Maximum cost reduction reached for this buff.", "info");
         return prev;
      }

      const newMetaKnowledge = JSON.parse(JSON.stringify(prev.metaKnowledge)) as MetaKnowledge;
      newMetaKnowledge.points -= cost;
      
      let buffName = "";
      // Buff improvements are additive or specific (like cost reduction)
      switch (buffKey) {
        case 'tickMultiplier': newMetaKnowledge.buffs.tickMultiplier += 0.05; buffName = "Tick Multiplier"; break;
        case 'costMultiplier': newMetaKnowledge.buffs.costMultiplier = Math.max(0.5, newMetaKnowledge.buffs.costMultiplier - 0.02); buffName = "Cost Reduction"; break;
        case 'entropyReductionMultiplier': newMetaKnowledge.buffs.entropyReductionMultiplier += 0.05; buffName = "Entropy Reduction"; break;
        case 'memoryMultiplier': newMetaKnowledge.buffs.memoryMultiplier += 0.05; buffName = "Memory Multiplier"; break;
      }
      // Ensure floating point values are tidy
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
  
  const garbageCollectionCost = Math.floor(10 * gameState.metaKnowledge.buffs.costMultiplier);

  return (
    <>
      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-50 space-y-2 w-auto max-w-xs sm:max-w-sm">
        {toasts.map(toast => (
          <div key={toast.id} className={`p-3 rounded-md shadow-lg text-sm font-medium animate-fadeIn ${
            toast.type === 'success' ? 'bg-green-600 text-white' : 
            toast.type === 'error' ? 'bg-red-600 text-white' :
            'bg-blue-600 text-white' // info
          } border ${
            toast.type === 'success' ? 'border-green-700' : 
            toast.type === 'error' ? 'border-red-700' : 
            'border-blue-700'
          }`}>
            {toast.message}
          </div>
        ))}
      </div>

      {/* Main Game Layout */}
      <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">
        {/* Left Panel: Resources, Upgrades, Actions */}
        <div className="lg:w-1/3 xl:w-1/4 flex flex-col space-y-4 sm:space-y-6">
          <ResourcePanel gameState={gameState} />
          <UpgradePanel gameState={gameState} buyUpgrade={buyUpgrade} />
          <button
            onClick={garbageCollect}
            disabled={gameState.resources.ticks < garbageCollectionCost}
            title={gameState.resources.ticks < garbageCollectionCost ? `Not enough Ticks (Need ${garbageCollectionCost})` : `Cost: ${garbageCollectionCost} Ticks`}
            className="w-full px-4 py-3 rounded font-semibold bg-yellow-500 hover:bg-yellow-600 text-black disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150"
          >
            Garbage Collection (Cost: {garbageCollectionCost})
          </button>
        </div>
        
        {/* Right Panel: Tabbed Content */}
        <div className="lg:w-2/3 xl:w-3/4 bg-background-secondary rounded-md border border-border-primary shadow-lg p-4 sm:p-6 min-h-[calc(100vh-250px)] sm:min-h-[calc(100vh-200px)]"> {/* Adjusted min-height for varying viewport/footer */}
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
                aria-current={activeTab === tabInfo.key ? "page" : undefined}
              >
                {tabInfo.label}
              </button>
            ))}
          </div>
          
          {tabs.find(tabInfo => tabInfo.key === activeTab)?.component}
        </div>
      </div>
    </>
  );
};

export default Game;