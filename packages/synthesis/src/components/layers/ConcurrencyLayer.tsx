// src/components/layers/ConcurrencyLayer.tsx
import React, { useEffect, useCallback } from 'react'; // Removed useState for threads/locks
import { 
  type GameState, 
  type ThreadState,
  type GlobalConcurrencyLocks,
  calculateActualMaxMemory, 
  calculateMaxThreads, 
  CODE_COST_HIGHLEVEL_PER_CHAR,
  initialConcurrencyThreadCode
} from '../../types/gameState';

interface ConcurrencyLayerProps {
  gameState: GameState;
  runCode: (code: string, layer: string, threadId?: number) => { success: boolean; ticksGenerated: number };
  onThreadsChange: (updater: (prevThreads: ThreadState[]) => ThreadState[]) => void;
  onGlobalLocksChange: (updater: (prevLocks: GlobalConcurrencyLocks) => GlobalConcurrencyLocks) => void;
  // onThreadOutputChange is replaced by directly modifying threads in onThreadsChange
}


const ConcurrencyLayer: React.FC<ConcurrencyLayerProps> = ({ 
  gameState, 
  runCode,
  onThreadsChange,
  onGlobalLocksChange,
}) => {
  const [deadlockDetected, setDeadlockDetected] = React.useState<boolean>(false);

  const { concurrencyThreads: threads, concurrencyGlobalLocks: globalLocks } = gameState.layerSpecificStates;

  const availableLocks = ['shared_data_A', 'shared_buffer_B', 'critical_section_C'];
  const actualMaxMemory = calculateActualMaxMemory(gameState);
  const maxThreads = calculateMaxThreads(gameState);
  const totalCodeSize = threads.reduce((sum, t) => sum + t.code.length * CODE_COST_HIGHLEVEL_PER_CHAR, 0);

  useEffect(() => {
    const runningThreads = threads.filter(t => t.status === 'running');
    if (runningThreads.length < 2) {
      setDeadlockDetected(false);
      return;
    }
    let isDeadlocked = false;
    if (runningThreads.length > 1 && Object.keys(globalLocks).length > 0) {
       const threadsWantingLocks = runningThreads.filter(t => t.code.includes('acquireLock') && t.acquiredLocks.length < availableLocks.length); // Simplified check
       if (threadsWantingLocks.length === runningThreads.length && threadsWantingLocks.length > 1) {
         if (Math.random() < 0.1 * threadsWantingLocks.length) {
            isDeadlocked = true;
         }
       }
    }
    setDeadlockDetected(isDeadlocked);
  }, [threads, globalLocks, availableLocks.length]);
  
  const createNewThread = useCallback(() => {
    onThreadsChange(prevThreads => {
      if (prevThreads.length >= maxThreads) return prevThreads;
      const newId = prevThreads.length > 0 ? Math.max(...prevThreads.map(t => t.id)) + 1 : 1;
      const newThread: ThreadState = { 
        id: newId, 
        code: initialConcurrencyThreadCode(newId), 
        status: 'idle', 
        output: `// Thread ${newId} ready`, 
        ticksGeneratedLastRun: 0, 
        acquiredLocks: [] 
      };
      return [...prevThreads, newThread];
    });
  }, [maxThreads, onThreadsChange]);
  
  const removeThread = useCallback((id: number) => {
    onGlobalLocksChange(prevGlobalLocks => {
      const threadToRemove = threads.find(t => t.id === id); // get current threads from gameState for this check
      let newGlobalLocks = { ...prevGlobalLocks };
      if (threadToRemove) {
        threadToRemove.acquiredLocks.forEach(lockName => {
          if (newGlobalLocks[lockName] === id) delete newGlobalLocks[lockName];
        });
      }
      return newGlobalLocks;
    });
    onThreadsChange(prevThreads => prevThreads.filter(t => t.id !== id));
  }, [threads, onThreadsChange, onGlobalLocksChange]); // threads from gameState
  
  const updateThreadCode = useCallback((id: number, newCode: string) => {
    onThreadsChange(prevThreads => prevThreads.map(t => t.id === id ? {...t, code: newCode} : t));
  }, [onThreadsChange]);
  
  const toggleLock = useCallback((threadId: number, lockName: string) => {
    onThreadsChange(prevThreads => {
        let newGlobalLocksLocal = { ...gameState.layerSpecificStates.concurrencyGlobalLocks }; // Get fresh globalLocks
        const updatedThreads = prevThreads.map(t => {
            if (t.id === threadId) {
                if (t.acquiredLocks.includes(lockName)) { // Release
                    if (newGlobalLocksLocal[lockName] === threadId) delete newGlobalLocksLocal[lockName];
                    return {...t, acquiredLocks: t.acquiredLocks.filter(l => l !== lockName)};
                } else { // Acquire
                    if (newGlobalLocksLocal[lockName] === undefined) { // Lock is available
                        newGlobalLocksLocal[lockName] = threadId;
                        return {...t, acquiredLocks: [...t.acquiredLocks, lockName]};
                    }
                }
            }
            return t;
        });
        // Only update global locks if they actually changed
        if (JSON.stringify(newGlobalLocksLocal) !== JSON.stringify(gameState.layerSpecificStates.concurrencyGlobalLocks)) {
             onGlobalLocksChange(() => newGlobalLocksLocal); // Updater fn for safety
        }
        return updatedThreads;
    });
  }, [onThreadsChange, onGlobalLocksChange, gameState.layerSpecificStates.concurrencyGlobalLocks]);

  const executeThread = useCallback((threadId: number) => {
    const thread = threads.find(t => t.id === threadId); // Find from current gameState.layerSpecificStates.threads
    if (!thread || thread.status === 'running') return;

    let newOutput = '';
    let newStatus: ThreadState['status'] | undefined = undefined;

    if (totalCodeSize > actualMaxMemory) {
      newOutput = `ERROR: Total memory for threads exceeded. Max: ${actualMaxMemory.toFixed(0)} CU`;
      newStatus = 'error';
    } else if (deadlockDetected) {
      newOutput = 'ERROR: Deadlock detected! Resolve deadlock or reset threads.';
      newStatus = 'error';
    }

    if (newStatus === 'error') {
      onThreadsChange(prevThreads => prevThreads.map(t => t.id === threadId ? {...t, output: newOutput, status: newStatus as ThreadState['status']} : t));
      return;
    }

    onThreadsChange(prevThreads => prevThreads.map(t => t.id === threadId ? {...t, status: 'running', output: '// Executing thread...'} : t));
    
    setTimeout(() => {
      // Crucial: Inside setTimeout, get the LATEST state of the specific thread to avoid stale closures
      const currentThreadForTimeout = gameState.layerSpecificStates.concurrencyThreads.find(t => t.id === threadId);
      if (!currentThreadForTimeout) return;

      const result = runCode(currentThreadForTimeout.code, 'concurrency', threadId);
      const hasLocks = currentThreadForTimeout.acquiredLocks.length > 0;
      // Check other running threads from the latest gameState
      const otherThreadsRunning = gameState.layerSpecificStates.concurrencyThreads.some(t => t.status === 'running' && t.id !== threadId);
      const potentialRaceCondition = !hasLocks && otherThreadsRunning && Math.random() < 0.25;

      let finalTicksGenerated = result.ticksGenerated;
      let finalOutputMessage = '';
      let finalThreadStatus: ThreadState['status'] = 'error';

      if (result.success && !potentialRaceCondition) {
        finalThreadStatus = 'completed';
        finalOutputMessage = `SUCCESS: Thread ${threadId} generated ${result.ticksGenerated} ticks.\nLocks held: ${currentThreadForTimeout.acquiredLocks.join(', ') || 'none'}`;
      } else {
        if (potentialRaceCondition) {
          finalTicksGenerated = Math.floor(result.ticksGenerated * 0.3);
          finalOutputMessage = `ERROR: Race condition detected in Thread ${threadId}!\nGenerated only ${finalTicksGenerated} ticks.`;
        } else {
            finalOutputMessage = `ERROR: Thread ${threadId} execution failed.\nGenerated ${finalTicksGenerated} ticks.`;
        }
      }
      
      onThreadsChange(prevThreads => prevThreads.map(t => t.id === threadId ? {
        ...t, 
        status: finalThreadStatus, 
        output: finalOutputMessage,
        ticksGeneratedLastRun: finalTicksGenerated
      } : t));
    }, 1000 + Math.random() * 1000);
  }, [
    threads, // For initial checks from current render
    gameState.layerSpecificStates.concurrencyThreads, // For fresh state inside timeout
    runCode, 
    actualMaxMemory, 
    totalCodeSize, 
    deadlockDetected, 
    onThreadsChange
  ]);

  const resolveDeadlock = useCallback(() => {
    onThreadsChange(prevThreads => prevThreads.map(t => {
      if (t.status === 'running' || t.acquiredLocks.length > 0) {
        return {...t, status: 'idle', output: 'Thread reset due to deadlock resolution.', acquiredLocks: []};
      }
      return t;
    }));
    onGlobalLocksChange(() => ({})); // Reset all global locks
    setDeadlockDetected(false);
  }, [onThreadsChange, onGlobalLocksChange]);
  
  return (
    <div className="animate-fadeIn">
      <h3 className="text-xl mb-4 text-accent-primary">Concurrency Layer</h3>
       <div className="bg-background-secondary p-4 rounded border border-border-primary shadow-md mb-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
          <p className="text-text-secondary mb-2 sm:mb-0">
            Manage multiple execution threads. Max Threads: {maxThreads}.
            <br /> Total Code Memory: <span className={totalCodeSize > actualMaxMemory ? "text-error-primary" : "text-text-primary"}>{totalCodeSize.toFixed(1)}</span> / {actualMaxMemory.toFixed(0)} CU
          </p>
          <div className="flex gap-2">
            <button
              onClick={createNewThread}
              disabled={threads.length >= maxThreads || totalCodeSize > actualMaxMemory}
              title={threads.length >= maxThreads ? "Max threads reached" : totalCodeSize > actualMaxMemory ? "Not enough memory for new thread code" : "Create new thread"}
              className="px-3 py-2 rounded font-semibold bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 text-sm"
            >
              Add Thread
            </button>
            {deadlockDetected && (
              <button onClick={resolveDeadlock} className="px-3 py-2 rounded font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors duration-150 text-sm">
                Resolve Deadlock
              </button>
            )}
          </div>
        </div>

        {deadlockDetected && (
          <div className="bg-red-700 bg-opacity-50 text-red-100 p-3 rounded mb-4 text-sm border border-red-600">
            ⚠️ DEADLOCK DETECTED! Multiple threads are blocked. Use "Resolve Deadlock" or manage locks.
          </div>
        )}

         <div className="mb-4">
          <h4 className="font-medium mb-1 text-text-primary">Available Locks:</h4>
          <div className="flex flex-wrap gap-2">
            {availableLocks.map(lock => (
              <div 
                key={lock}
                className={`px-2 py-1 rounded text-xs ${
                  globalLocks[lock] !== undefined 
                    ? 'bg-red-700 text-gray-200' 
                    : 'bg-green-700 text-gray-200'
                }`}
              >
                {lock} {globalLocks[lock] !== undefined && `(Held by T${globalLocks[lock]})`}
              </div>
            ))}
          </div>
        </div>
        
        <div className="space-y-4">
          {threads.map(thread => (
            <div key={thread.id} className="bg-gray-900 p-3 rounded border border-border-secondary">
              <div className="flex justify-between items-center mb-2">
                <h5 className="font-medium text-text-primary">Thread {thread.id}</h5>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 text-xs rounded font-semibold ${
                    thread.status === 'idle' ? 'bg-gray-600 text-gray-300' :
                    thread.status === 'running' ? 'bg-yellow-500 text-black animate-pulseOnce' :
                    thread.status === 'completed' ? 'bg-green-500 text-black' :
                    'bg-red-500 text-white'
                  }`}>
                    {thread.status.toUpperCase()}
                  </span>
                  <button onClick={() => removeThread(thread.id)} disabled={thread.status === 'running'} className="text-xs bg-red-700 hover:bg-red-800 text-white px-2 py-1 rounded disabled:opacity-50">
                    X
                  </button>
                </div>
              </div>
              
              <div className="flex flex-col md:flex-row gap-3 mb-2">
                <div className="md:w-1/2">
                   <label className="block text-xs font-medium text-text-secondary mb-1">Code (Thread {thread.id}):</label>
                  <textarea
                    value={thread.code}
                    onChange={(e) => updateThreadCode(thread.id, e.target.value)}
                    disabled={thread.status === 'running'}
                    className="w-full h-40 bg-gray-800 text-gray-100 p-2 rounded border border-gray-700 font-mono text-xs focus:ring-1 focus:ring-accent-primary focus:border-accent-primary"
                    spellCheck="false"
                  />
                </div>
                <div className="md:w-1/2">
                  <label className="block text-xs font-medium text-text-secondary mb-1">Output:</label>
                  <div className="w-full h-40 bg-gray-800 text-gray-100 p-2 rounded border border-gray-700 font-mono text-xs overflow-auto whitespace-pre-wrap">
                    {thread.output || "// Output will appear here"}
                  </div>
                </div>
              </div>
              
              <div className="text-xs text-text-secondary mb-2">
                Locks Acquired: {thread.acquiredLocks.join(', ') || 'None'}
              </div>
              <div className="flex flex-wrap gap-2 mb-3">
                {availableLocks.map(lockName => (
                  <button
                    key={lockName}
                    onClick={() => toggleLock(thread.id, lockName)}
                    disabled={
                      thread.status === 'running' || 
                      (globalLocks[lockName] !== undefined && globalLocks[lockName] !== thread.id) 
                    }
                    className={`px-2 py-1 text-xs rounded font-medium transition-colors ${
                      thread.acquiredLocks.includes(lockName)
                        ? 'bg-red-600 hover:bg-red-700 text-white'
                        : 'bg-green-600 hover:bg-green-700 text-white'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {thread.acquiredLocks.includes(lockName) ? `Release ${lockName}` : `Acquire ${lockName}`}
                  </button>
                ))}
              </div>
              
              <div className="flex justify-end">
                <button
                  onClick={() => executeThread(thread.id)}
                  disabled={thread.status === 'running' || totalCodeSize > actualMaxMemory}
                  className="px-3 py-1.5 rounded font-semibold bg-accent-primary hover:bg-green-600 text-black disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 text-sm"
                >
                  Run Thread
                </button>
              </div>
              
              {thread.ticksGeneratedLastRun > 0 && (
                <div className="mt-1 text-xs text-green-400">
                  Last run generated: {thread.ticksGeneratedLastRun} ticks
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ConcurrencyLayer;