// src/hooks/useGameState.ts
import { useState, useEffect, useCallback } from 'react';
import { 
  type GameState, 
  initialGameState, 
  type LayerSpecificStates, 
  type MetaKnowledge,
  type ThreadState, 
  type GlobalConcurrencyLocks, 
  STORAGE_KEY,
  calculateActualMaxMemoryValue
} from '../types/gameState';
import { type Toast } from '../components/ToastSystem';

// mergeWithInitialState needs to be robust to the new GameState structure.
// The existing merge logic seems generally fine, but let's ensure deep copies
// for LayerSpecificStates and MetaKnowledge use the new initial structures if parts are missing.
const mergeWithInitialState = (parsed: Partial<GameState>): GameState => {
  let needsSave = false;
  // Spread initialGameState first, then parsed state to ensure all keys from initialGameState are present
  // and parsed values override them if they exist.
  const mergedState = { ...initialGameState, ...parsed };

  // Ensure all top-level keys from initialGameState exist
  (Object.keys(initialGameState) as Array<keyof GameState>).forEach(key => {
    if (mergedState[key] === undefined) {
      (mergedState as any)[key] = initialGameState[key];
      needsSave = true;
    }
  });

  // Resources: ensure all sub-keys exist
  if (parsed.resources) {
    mergedState.resources = { ...initialGameState.resources, ...parsed.resources };
  } else {
    mergedState.resources = { ...initialGameState.resources };
    needsSave = true;
  }
  
  // Upgrades: ensure all sub-keys exist
   if (parsed.upgrades) {
    mergedState.upgrades = { ...initialGameState.upgrades, ...parsed.upgrades };
  } else {
    mergedState.upgrades = { ...initialGameState.upgrades };
    needsSave = true;
  }

  // UpgradeCosts: ensure all sub-keys exist
  if (parsed.upgradeCosts) {
    mergedState.upgradeCosts = { ...initialGameState.upgradeCosts, ...parsed.upgradeCosts };
  } else {
    mergedState.upgradeCosts = { ...initialGameState.upgradeCosts };
    needsSave = true;
  }


  // Deep check and merge for layerSpecificStates
  if (!parsed.layerSpecificStates || typeof parsed.layerSpecificStates !== 'object' || parsed.layerSpecificStates === null) {
    mergedState.layerSpecificStates = JSON.parse(JSON.stringify(initialGameState.layerSpecificStates));
    needsSave = true;
  } else {
    // Ensure all keys from initialLayerSpecificStates are present
    mergedState.layerSpecificStates = { 
      ...JSON.parse(JSON.stringify(initialGameState.layerSpecificStates)), 
      ...parsed.layerSpecificStates 
    };
    // Further ensure nested structures like concurrencyThreads are arrays if they exist in parsed
    if (parsed.layerSpecificStates.concurrencyThreads && !Array.isArray(parsed.layerSpecificStates.concurrencyThreads)) {
        mergedState.layerSpecificStates.concurrencyThreads = [...initialGameState.layerSpecificStates.concurrencyThreads];
        needsSave = true;
    } else if (parsed.layerSpecificStates.concurrencyThreads) {
        // Ensure each thread has the new structure (basic check)
        mergedState.layerSpecificStates.concurrencyThreads = parsed.layerSpecificStates.concurrencyThreads.map(t => ({
            ...initialGameState.layerSpecificStates.concurrencyThreads[0], // Provides default structure
            ...t,
        }));
    }
    if (parsed.layerSpecificStates.concurrencyGlobalLocks && (typeof parsed.layerSpecificStates.concurrencyGlobalLocks !== 'object' || parsed.layerSpecificStates.concurrencyGlobalLocks === null)){
        mergedState.layerSpecificStates.concurrencyGlobalLocks = {...initialGameState.layerSpecificStates.concurrencyGlobalLocks};
        needsSave = true;
    }
  }


  // Deep check for metaKnowledge and its buffs
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
  return mergedState as GameState; // Cast as we've tried to ensure structure
};


export const useGameState = () => {
  const [gameState, setGameState] = useState<GameState>(() => {
    const savedState = localStorage.getItem(STORAGE_KEY);
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState) as Partial<GameState>;
        // Update maxMemory based on saved levels, as it's now stored directly
        const tempMerged = mergeWithInitialState(parsed);
        tempMerged.resources.maxMemory = calculateActualMaxMemoryValue(
            tempMerged.upgrades.memoryLevel, 
            tempMerged.metaKnowledge.buffs.memoryMultiplier
        );
        return tempMerged;
      } catch (error) {
        console.error(`Failed to parse saved game state (${STORAGE_KEY}). Resetting to initial state. Error:`, error);
        localStorage.removeItem(STORAGE_KEY); 
        return JSON.parse(JSON.stringify(initialGameState)); // Fresh deep copy
      }
    }
    return JSON.parse(JSON.stringify(initialGameState)); // Fresh deep copy
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
  // Types for updater functions now use the new ThreadState and GlobalConcurrencyLocks
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
    setGameState,
    toasts,
    addToast,
    handleAssemblyCodeChange,
    handleAssemblyOutputSet,
    handleHighLevelCodeChange,
    handleHighLevelOutputSet,
    handleConcurrencyThreadsChange,
    handleConcurrencyGlobalLocksChange,
    toggleAutoTick,
  };
};