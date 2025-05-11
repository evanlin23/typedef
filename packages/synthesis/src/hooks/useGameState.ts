// src/hooks/useGameState.ts
import { useState, useEffect, useCallback } from 'react';
import { 
  type GameState, 
  initialGameState, 
  type ThreadState, 
  type GlobalConcurrencyLocks, 
  STORAGE_KEY,
  calculateActualMaxMemoryValue
} from '../types/gameState';
import { type Toast } from '../components/ToastSystem';

// ** mergeWithInitialState remains crucial for handling saved data robustness **
const mergeWithInitialState = (parsed: Partial<GameState>): GameState => {
  let needsSave = false;
  const mergedState = { ...initialGameState, ...parsed };

  (Object.keys(initialGameState) as Array<keyof GameState>).forEach(key => {
    if (mergedState[key] === undefined) {
      (mergedState as any)[key] = initialGameState[key];
      needsSave = true;
    }
  });

  if (parsed.resources) {
    mergedState.resources = { ...initialGameState.resources, ...parsed.resources };
  } else {
    mergedState.resources = { ...initialGameState.resources };
    needsSave = true;
  }
  
   if (parsed.upgrades) {
    mergedState.upgrades = { ...initialGameState.upgrades, ...parsed.upgrades };
  } else {
    mergedState.upgrades = { ...initialGameState.upgrades };
    needsSave = true;
  }

  if (parsed.upgradeCosts) {
    mergedState.upgradeCosts = { ...initialGameState.upgradeCosts, ...parsed.upgradeCosts };
  } else {
    mergedState.upgradeCosts = { ...initialGameState.upgradeCosts };
    needsSave = true;
  }

  if (!parsed.layerSpecificStates || typeof parsed.layerSpecificStates !== 'object' || parsed.layerSpecificStates === null) {
    mergedState.layerSpecificStates = JSON.parse(JSON.stringify(initialGameState.layerSpecificStates));
    needsSave = true;
  } else {
    mergedState.layerSpecificStates = { 
      ...JSON.parse(JSON.stringify(initialGameState.layerSpecificStates)), 
      ...parsed.layerSpecificStates 
    };
    if (parsed.layerSpecificStates.concurrencyThreads && !Array.isArray(parsed.layerSpecificStates.concurrencyThreads)) {
        mergedState.layerSpecificStates.concurrencyThreads = [...initialGameState.layerSpecificStates.concurrencyThreads];
        needsSave = true;
    } else if (parsed.layerSpecificStates.concurrencyThreads) {
        mergedState.layerSpecificStates.concurrencyThreads = parsed.layerSpecificStates.concurrencyThreads.map(t => ({
            ...initialGameState.layerSpecificStates.concurrencyThreads[0], 
            ...t,
             acquiredLocks: Array.isArray(t.acquiredLocks) ? t.acquiredLocks : [], // Ensure acquiredLocks is an array
        }));
    }
    if (parsed.layerSpecificStates.concurrencyGlobalLocks && (typeof parsed.layerSpecificStates.concurrencyGlobalLocks !== 'object' || parsed.layerSpecificStates.concurrencyGlobalLocks === null)){
        mergedState.layerSpecificStates.concurrencyGlobalLocks = {...initialGameState.layerSpecificStates.concurrencyGlobalLocks};
        needsSave = true;
    }
  }

  if (!parsed.metaKnowledge || typeof parsed.metaKnowledge !== 'object' || parsed.metaKnowledge === null) {
    mergedState.metaKnowledge = JSON.parse(JSON.stringify(initialGameState.metaKnowledge));
    needsSave = true;
  } else {
    mergedState.metaKnowledge = { ...JSON.parse(JSON.stringify(initialGameState.metaKnowledge)), ...parsed.metaKnowledge };
    if (!parsed.metaKnowledge.buffs || typeof parsed.metaKnowledge.buffs !== 'object' || parsed.metaKnowledge.buffs === null) {
      mergedState.metaKnowledge.buffs = JSON.parse(JSON.stringify(initialGameState.metaKnowledge.buffs));
      needsSave = true;
    } else {
      mergedState.metaKnowledge.buffs = { ...initialGameState.metaKnowledge.buffs, ...parsed.metaKnowledge.buffs };
    }
  }
  
  if (needsSave) {
    console.log("Migrated or initialized parts of old save data structure for key:", STORAGE_KEY);
  }
  return mergedState as GameState;
};


export const useGameState = () => {
  const [gameState, setGameState] = useState<GameState>(() => {
    const savedState = localStorage.getItem(STORAGE_KEY);
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState) as Partial<GameState>;
        const tempMerged = mergeWithInitialState(parsed);
        // Ensure maxMemory is correctly set after merging, as it's now a direct state value
        tempMerged.resources.maxMemory = calculateActualMaxMemoryValue(
            tempMerged.upgrades.memoryLevel, 
            tempMerged.metaKnowledge.buffs.memoryMultiplier
        );
        // Ensure totalTicksGeneratedAllTime is a number
        if (typeof tempMerged.totalTicksGeneratedAllTime !== 'number') {
            tempMerged.totalTicksGeneratedAllTime = 0;
        }

        return tempMerged;
      } catch (error) {
        console.error(`Failed to parse saved game state (${STORAGE_KEY}). Resetting to initial state. Error:`, error);
        localStorage.removeItem(STORAGE_KEY); 
        return JSON.parse(JSON.stringify(initialGameState));
      }
    }
    return JSON.parse(JSON.stringify(initialGameState));
  });
  
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const newToast = { id: Date.now(), message, type };
    setToasts(prevToasts => {
        const updatedToasts = [...prevToasts, newToast];
        return updatedToasts.length > 5 ? updatedToasts.slice(updatedToasts.length - 5) : updatedToasts;
    });
    setTimeout(() => {
      setToasts(prevToasts => prevToasts.filter(t => t.id !== newToast.id));
    }, 3000 + (type === 'error' ? 1000 : 0));
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({...gameState, lastSaveTime: Date.now()}));
  }, [gameState]);

  // ** These handlers are now returned to be included in the GameContext **
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
  
  const toggleAutoTick = useCallback(() => {
    setGameState(prev => ({ ...prev, autoTickEnabled: !prev.autoTickEnabled }));
  }, []);

  return {
    gameState,
    setGameState, // Still return setGameState for the GameProvider
    toasts,
    addToast,
    // ** Return handlers for the context **
    handleAssemblyCodeChange,
    handleAssemblyOutputSet,
    handleHighLevelCodeChange,
    handleHighLevelOutputSet,
    handleConcurrencyThreadsChange,
    handleConcurrencyGlobalLocksChange,
    toggleAutoTick,
  };
};