import { useState, useEffect, useCallback } from 'react';
import ResourcePanel from './ResourcePanel';
import MachineLayer from './layers/MachineLayer';
import AssemblyLayer from './layers/AssemblyLayer';
import HighLevelLayer from './layers/HighLevelLayer';
import ConcurrencyLayer from './layers/ConcurrencyLayer';
import AILayer from './layers/AILayer';
import UpgradePanel from './UpgradePanel';
import PrestigePanel, { getMetaBuffUpgradeCost } from './PrestigePanel'; // Import helper
import { 
  type GameState, initialGameState, GAME_LOOP_INTERVAL_MS, MAX_ENTROPY,
  ENTROPY_PER_PROCESS_PER_SEC, OPTIMIZATION_ENTROPY_REDUCTION_PER_LEVEL,
  calculateActualMaxMemory, calculateEffectiveTickRate,
  type UpgradeCosts, type MetaKnowledge, type LayerBuff, type ActiveLayerBuffs,
  CODE_COST_ASSEMBLY_PER_CHAR, CODE_COST_HIGHLEVEL_PER_CHAR,
  BASE_TICK_RATE_PER_CPU_LEVEL, AI_CORE_TICK_RATE_PER_LEVEL,
  type ThreadState, type GlobalConcurrencyLocks, type LayerSpecificStates,
  initialAssemblyCode, initialHighLevelCode, initialConcurrencyThreadCode // Import initial codes
} from '../types/gameState';

const STORAGE_KEY = 'synthesis_game_state_v2.3'; // Incremented for any structural change that needs re-evaluation

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
                 // Ensure concurrencyThreads is an array
                if (lsKey === 'concurrencyThreads' && !Array.isArray(parsedLS[lsKey])) {
                    parsedLS.concurrencyThreads = [...initialLS.concurrencyThreads];
                    needsSave = true;
                }
                // Ensure concurrencyGlobalLocks is an object
                 if (lsKey === 'concurrencyGlobalLocks' && (typeof parsedLS[lsKey] !== 'object' || parsedLS[lsKey] === null)) {
                    parsedLS.concurrencyGlobalLocks = {...initialLS.concurrencyGlobalLocks};
                    needsSave = true;
                }
            });
        }

        // Deep check for metaKnowledge and its buffs
        if (!parsed.metaKnowledge || typeof parsed.metaKnowledge !== 'object' || parsed.metaKnowledge === null) {
            parsed.metaKnowledge = { ...initialGameState.metaKnowledge };
            needsSave = true;
        } else {
            if (!parsed.metaKnowledge.buffs || typeof parsed.metaKnowledge.buffs !== 'object' || parsed.metaKnowledge.buffs === null) {
                parsed.metaKnowledge.buffs = { ...initialGameState.metaKnowledge.buffs };
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
        }
        
        // Deep checks for upgrades and upgradeCosts
        ['upgrades', 'upgradeCosts'].forEach(objKeyStr => {
            const objKey = objKeyStr as 'upgrades' | 'upgradeCosts';
            if (!parsed[objKey] || typeof parsed[objKey] !== 'object' || parsed[objKey] === null) {
                (parsed as any)[objKey] = { ...initialGameState[objKey] };
                needsSave = true;
            } else {
                const initialSubObj = initialGameState[objKey];
                const parsedSubObj = parsed[objKey] as any; 
                 (Object.keys(initialSubObj) as Array<keyof typeof initialSubObj>).forEach(subKey => {
                    if (parsedSubObj[subKey] === undefined) {
                        parsedSubObj[subKey] = initialSubObj[subKey];
                        needsSave = true;
                    }
                });
            }
        });

        if (needsSave) {
            console.log("Migrated old save data structure for key:", STORAGE_KEY);
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
        
        const runningThreadsCount = prev.layerSpecificStates.concurrencyThreads.filter(t => t.status === 'running').length;
        const otherActiveProcesses = prev.activeProcesses - prev.layerSpecificStates.concurrencyThreads.filter(t => t.status !== 'idle').length; 
        const currentTotalActiveProcesses = Math.max(0, otherActiveProcesses) + runningThreadsCount;

        const baseEntropyGain = currentTotalActiveProcesses * (ENTROPY_PER_PROCESS_PER_SEC / (1000 / GAME_LOOP_INTERVAL_MS));
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
          activeProcesses: currentTotalActiveProcesses,
          totalTicksGeneratedAllTime: prev.totalTicksGeneratedAllTime + totalPassiveTicksThisInterval,
          activeLayerBuffs: newActiveLayerBuffs,
        };
      });
    }, GAME_LOOP_INTERVAL_MS);
    return () => clearInterval(gameLoop);
  }, [addToast]);

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
  }, [gameState]);

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
        if (costOnClick !== actualPaymentCost && Math.abs(costOnClick - actualPaymentCost) > 1) {
             addToast("Cost updated. Please try again.", "error");
        } else {
            addToast("Not enough Ticks for this upgrade.", "error");
        }
        return prev;
      }
      
      const newState = JSON.parse(JSON.stringify(prev)) as GameState;
      newState.resources.ticks -= actualPaymentCost;
      
      let upgradeNameForToast = "";
      let newLevelForToast: number | undefined;

      const cpuCostMultiplier = 1.5;
      const memoryCostMultiplier = 1.6;
      const optCostMultiplier = 1.8;
      const aiCoreCostMultiplier = 1.7;
      const threadsCostMultiplier = 2.0;

      switch (upgradeKey) {
        case 'cpu':
          newState.upgrades.cpuLevel += 1;
          newState.upgradeCosts.cpu = Math.floor(currentStoredBaseCostForNextLevel * cpuCostMultiplier);
          upgradeNameForToast = "CPU Core Clock"; newLevelForToast = newState.upgrades.cpuLevel; break;
        case 'memory':
          newState.upgrades.memoryLevel += 1;
          newState.upgradeCosts.memory = Math.floor(currentStoredBaseCostForNextLevel * memoryCostMultiplier);
          upgradeNameForToast = "Memory Capacity"; newLevelForToast = newState.upgrades.memoryLevel; break;
        case 'optimization':
          newState.upgrades.optimizationLevel += 1;
          newState.upgradeCosts.optimization = Math.floor(currentStoredBaseCostForNextLevel * optCostMultiplier);
          upgradeNameForToast = "System Optimization"; newLevelForToast = newState.upgrades.optimizationLevel; break;
        case 'aiCore':
          newState.upgrades.aiCoreLevel += 1;
          newState.upgradeCosts.aiCore = Math.floor(currentStoredBaseCostForNextLevel * aiCoreCostMultiplier);
          upgradeNameForToast = "AI Computation Cores"; newLevelForToast = newState.upgrades.aiCoreLevel; break;
        case 'maxThreads':
          newState.upgrades.maxThreadsLevel +=1;
          newState.upgradeCosts.maxThreads = Math.floor(currentStoredBaseCostForNextLevel * threadsCostMultiplier);
          upgradeNameForToast = "Thread Scheduler"; newLevelForToast = newState.upgrades.maxThreadsLevel; break;
        default: 
          addToast("Error processing upgrade: Unknown key.", "error"); 
          console.error("Unknown upgrade key in buyUpgrade:", upgradeKey);
          return prev;
      }
      
      if (upgradeNameForToast && newLevelForToast !== undefined) {
          addToast(`${upgradeNameForToast} upgraded to Level ${newLevelForToast}!`, 'success');
      } else {
          addToast(`Upgrade successful!`, 'success');
      }
      return newState;
    });
  }, [addToast]);

  const runCode = useCallback((codeFromLayer: string, layer: string, _threadId?: number): { success: boolean; ticksGenerated: number } => {
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
      // Only increment activeProcesses for non-concurrent successful runs
      // Concurrency layer's "active process" count is implicitly handled by thread statuses for game loop entropy calculation
      if (success && layer !== 'concurrency') {
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

  const runUnitTests = useCallback((layer: string) => {
    const cost = layer === 'assembly' ? 5 : layer === 'highLevel' ? 15 : 10;
    
    // Outer check for immediate feedback
    if (gameState.resources.ticks < cost) {
      addToast(`Not enough Ticks to run unit tests for ${layer}. Cost: ${cost} Ticks.`, 'error');
      return;
    }

    setGameState(prev => {
      const currentTestCost = layer === 'assembly' ? 5 : layer === 'highLevel' ? 15 : 10;
      if (prev.resources.ticks < currentTestCost) {
        // Safeguard, unlikely if outer check passed and no immediate state change
        return prev;
      }
      
      const testSuccess = Math.random() < 0.7;
      let newActiveLayerBuffs = { ...prev.activeLayerBuffs };
      let newEntropy = prev.resources.entropy;

      if (testSuccess) {
        const buffDurationMs = 60 * 1000;
        const buffMultiplier = 1.2;
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
          ticks: Math.max(0, prev.resources.ticks - currentTestCost),
          entropy: newEntropy 
        },
        activeLayerBuffs: newActiveLayerBuffs,
      };
    });
  }, [gameState.resources.ticks, addToast]);

  const garbageCollect = useCallback(() => {
    const costForCheck = Math.floor(10 * gameState.metaKnowledge.buffs.costMultiplier);
    if (gameState.resources.ticks < costForCheck) {
        addToast("Not enough Ticks for Garbage Collection.", "error");
        return;
    }
    
    setGameState(prev => {
      const currentCost = Math.floor(10 * prev.metaKnowledge.buffs.costMultiplier);
      if (prev.resources.ticks < currentCost) {
        return prev; 
      }

      const entropyReductionAmount = 20 * prev.metaKnowledge.buffs.entropyReductionMultiplier;
      const activeProcessesToReduce = Math.floor(prev.activeProcesses * 0.25); // Reduce a quarter of non-thread processes

      const newEntropy = Math.max(0, prev.resources.entropy - entropyReductionAmount);
      const newTicks = Math.max(0, prev.resources.ticks - currentCost);
      const newActiveProcesses = Math.max(0, prev.activeProcesses - activeProcessesToReduce);
      
      let toastMessage = 'Garbage Collection ran. ';
      if (newEntropy < prev.resources.entropy) {
          toastMessage += 'Entropy reduced. ';
      } else {
          toastMessage += 'No entropy to reduce further. ';
      }
      if (newActiveProcesses < prev.activeProcesses) {
          toastMessage += 'Some idle processes cleared.';
      }
      addToast(toastMessage, 'info');

      return {
        ...prev,
        resources: { ...prev.resources, ticks: newTicks, entropy: newEntropy },
        activeProcesses: newActiveProcesses,
      };
    });
  }, [
    gameState.resources.ticks, 
    gameState.metaKnowledge.buffs.costMultiplier, 
    gameState.metaKnowledge.buffs.entropyReductionMultiplier,
    addToast
  ]);

  const calculateMkGain = useCallback((): number => {
    const fromTicks = Math.floor(gameState.totalTicksGeneratedAllTime / 1_000_000);
    const fromCpu = Math.floor(gameState.upgrades.cpuLevel / 10);
    const fromMemory = Math.floor(gameState.upgrades.memoryLevel / 5);
    const fromAICores = Math.floor(gameState.upgrades.aiCoreLevel / 5);
    const fromOptimization = Math.floor(gameState.upgrades.optimizationLevel / 8);
    const fromThreads = Math.floor(gameState.upgrades.maxThreadsLevel / 3);

    if (gameState.totalTicksGeneratedAllTime < 250000 && 
        (gameState.upgrades.cpuLevel < 5 || gameState.upgrades.memoryLevel < 3)) {
        return 0;
    }
    const totalMk = fromTicks + fromCpu + fromMemory + fromAICores + fromOptimization + fromThreads;
    return Math.max(0, Math.floor(totalMk));
  }, [gameState.totalTicksGeneratedAllTime, gameState.upgrades]);

  const handlePrestige = useCallback(() => {
    const mkGained = calculateMkGain();
    
    if (mkGained < 1) {
        if (!confirm("Your current progress might not yield significant Meta-Knowledge. Are you sure you want to prestige for 0 MK? This will reset your game progress.")) {
            addToast("Prestige cancelled. Continue enhancing your system!", "info");
            return;
        }
    } else {
        if (!confirm(`Are you sure you want to prestige and gain ${mkGained} Meta-Knowledge? This will reset your current game progress (except MK buffs).`)) {
            addToast("Prestige cancelled.", "info");
            return;
        }
    }

    const preservedMetaKnowledge: MetaKnowledge = {
      ...gameState.metaKnowledge,
      points: gameState.metaKnowledge.points + mkGained,
    };
    const preservedAutoTick = gameState.autoTickEnabled;
    
    // Reset layer specific states to their initial values
    const resetLayerStates: LayerSpecificStates = {
        assemblyCode: initialAssemblyCode,
        assemblyOutput: "// Assembly output will appear here",
        highLevelCode: initialHighLevelCode,
        highLevelOutput: "// High-level output will appear here",
        concurrencyThreads: [
          { 
            id: 1, 
            code: initialConcurrencyThreadCode(1), 
            status: 'idle', 
            output: '// Thread 1 ready', 
            ticksGeneratedLastRun: 0, 
            acquiredLocks: [] 
          }
        ],
        concurrencyGlobalLocks: {},
    };

    setGameState({
      ...initialGameState, 
      metaKnowledge: preservedMetaKnowledge,
      autoTickEnabled: preservedAutoTick,
      layerSpecificStates: resetLayerStates, 
      lastSaveTime: Date.now(), 
    });
    setActiveTab('machine');
    addToast(`Universe Recompiled! Gained ${mkGained} Meta-Knowledge. System rebooted with enhanced potential.`, 'success');
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
      const isMaxCostReduction = buffKey === 'costMultiplier' && currentBuffValue <= 0.501;
      if (isMaxCostReduction) {
         addToast("Maximum cost reduction reached for this buff.", "info");
         return prev;
      }

      const newMetaKnowledge = JSON.parse(JSON.stringify(prev.metaKnowledge)) as MetaKnowledge;
      newMetaKnowledge.points -= cost;
      
      let buffName = "";
      switch (buffKey) {
        case 'tickMultiplier': newMetaKnowledge.buffs.tickMultiplier += 0.05; buffName = "Tick Multiplier"; break;
        case 'costMultiplier': newMetaKnowledge.buffs.costMultiplier = Math.max(0.5, newMetaKnowledge.buffs.costMultiplier - 0.02); buffName = "Cost Reduction"; break;
        case 'entropyReductionMultiplier': newMetaKnowledge.buffs.entropyReductionMultiplier += 0.05; buffName = "Entropy Reduction"; break;
        case 'memoryMultiplier': newMetaKnowledge.buffs.memoryMultiplier += 0.05; buffName = "Memory Multiplier"; break;
      }
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
            Garbage Collection (Cost: {Math.floor(10 * gameState.metaKnowledge.buffs.costMultiplier)})
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
          
          {tabs.find(tabInfo => tabInfo.key === activeTab)?.component}
        </div>
      </div>
    </>
  );
};

export default Game;