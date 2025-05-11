// src/components/layers/ConcurrencyLayer.tsx
import React, { useEffect, useCallback, useState } from 'react';
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
}

const ConcurrencyLayer: React.FC<ConcurrencyLayerProps> = ({ 
  gameState, 
  runCode,
  onThreadsChange,
  onGlobalLocksChange,
}) => {
  const [deadlockDetected, setDeadlockDetected] = useState<boolean>(false);

  const { concurrencyThreads: threadsFromProps, concurrencyGlobalLocks: globalLocksFromProps } = gameState.layerSpecificStates;

  const availableLocks = ['shared_data_A', 'shared_buffer_B', 'critical_section_C'];
  const actualMaxMemory = calculateActualMaxMemory(gameState);
  const maxThreads = calculateMaxThreads(gameState);
  const totalCodeSize = threadsFromProps.reduce((sum, t) => sum + t.code.length * CODE_COST_HIGHLEVEL_PER_CHAR, 0);
  const idleThreadsCount = threadsFromProps.filter(t => t.status === 'idle').length;

  useEffect(() => {
    const runningThreads = threadsFromProps.filter(t => t.status === 'running');
    if (runningThreads.length < 2) {
      setDeadlockDetected(false);
      return;
    }
    let isDeadlocked = false;
    if (runningThreads.length > 1 && Object.keys(globalLocksFromProps).length > 0) {
       const threadsWantingLocks = runningThreads.filter(t => 
         t.code.includes('acquireLock') &&
         t.acquiredLocks.length < availableLocks.length
       );
       if (threadsWantingLocks.length === runningThreads.length && threadsWantingLocks.length > 1) {
         if (Math.random() < 0.1 * threadsWantingLocks.length) {
            isDeadlocked = true;
         }
       }
    }
    setDeadlockDetected(isDeadlocked);
  }, [threadsFromProps, globalLocksFromProps, availableLocks.length]);
  
  const createNewThread = useCallback(() => {
    onThreadsChange(prevThreads => {
      if (prevThreads.length >= maxThreads) return prevThreads;
      const newId = prevThreads.length > 0 ? Math.max(...prevThreads.map(t => t.id)) + 1 : 1;
      const newThread: ThreadState = { 
        id: newId, 
        code: initialConcurrencyThreadCode(newId), 
        status: 'idle', 
        output: `// Thread ${newId} ready. Edit code and run.`, 
        ticksGeneratedLastRun: 0, 
        acquiredLocks: [] 
      };
      return [...prevThreads, newThread];
    });
  }, [maxThreads, onThreadsChange]);
  
  const removeThread = useCallback((id: number) => {
    onGlobalLocksChange(prevGlobalLocks => {
      const threadToRemove = gameState.layerSpecificStates.concurrencyThreads.find(t => t.id === id);
      let newGlobalLocks = { ...prevGlobalLocks };
      if (threadToRemove) {
        threadToRemove.acquiredLocks.forEach(lockName => {
          if (newGlobalLocks[lockName] === id) delete newGlobalLocks[lockName];
        });
      }
      return newGlobalLocks;
    });
    onThreadsChange(prevThreads => prevThreads.filter(t => t.id !== id));
  }, [gameState.layerSpecificStates.concurrencyThreads, onThreadsChange, onGlobalLocksChange]);
  
  const updateThreadCode = useCallback((id: number, newCode: string) => {
    onThreadsChange(prevThreads => prevThreads.map(t => t.id === id ? {...t, code: newCode} : t));
  }, [onThreadsChange]);
  
  const toggleLock = useCallback((threadId: number, lockName: string) => {
    onThreadsChange(prevThreads => {
        let newGlobalLocksLocal = { ...gameState.layerSpecificStates.concurrencyGlobalLocks }; 
        const updatedThreads = prevThreads.map(t => {
            if (t.id === threadId) {
                if (t.acquiredLocks.includes(lockName)) { 
                    if (newGlobalLocksLocal[lockName] === threadId) { 
                        delete newGlobalLocksLocal[lockName];
                    }
                    return {...t, acquiredLocks: t.acquiredLocks.filter(l => l !== lockName)};
                } else { 
                    if (newGlobalLocksLocal[lockName] === undefined) { 
                        newGlobalLocksLocal[lockName] = threadId;
                        return {...t, acquiredLocks: [...t.acquiredLocks, lockName]};
                    }
                }
            }
            return t;
        });
        if (JSON.stringify(newGlobalLocksLocal) !== JSON.stringify(gameState.layerSpecificStates.concurrencyGlobalLocks)) {
             onGlobalLocksChange(() => newGlobalLocksLocal);
        }
        return updatedThreads;
    });
  }, [onThreadsChange, onGlobalLocksChange, gameState.layerSpecificStates.concurrencyGlobalLocks]);

  const executeSingleThread = useCallback((threadId: number) => {
    const threadToExecute = threadsFromProps.find(t => t.id === threadId);

    // Allow running if idle. Completed threads will also effectively re-run from idle.
    if (!threadToExecute || (threadToExecute.status !== 'idle' && threadToExecute.status !== 'completed')) {
        return;
    }

    if (totalCodeSize > actualMaxMemory) {
      onThreadsChange(prevThreads => prevThreads.map(t => t.id === threadId ? {...t, output: `ERROR: Total memory for threads exceeded. Max: ${actualMaxMemory.toFixed(0)} CU`, status: 'error'} : t));
      return;
    }
    if (deadlockDetected) {
      onThreadsChange(prevThreads => prevThreads.map(t => t.id === threadId ? {...t, output: 'ERROR: Deadlock detected! Resolve deadlock or reset threads.', status: 'error'} : t));
      return;
    }

    onThreadsChange(prevThreads => prevThreads.map(t => 
        t.id === threadId ? {
            ...t, 
            status: 'running', 
            output: '// Executing thread...', 
            ticksGeneratedLastRun: 0 
        } : t
    ));
    
    const codeForThisExecution = threadToExecute.code;
    const acquiredLocksForThisExecution = [...threadToExecute.acquiredLocks];

    setTimeout(() => {
      const result = runCode(codeForThisExecution, 'concurrency', threadId);
      
      let finalTicksGenerated = result.ticksGenerated;
      let finalOutputMessage = '';
      let finalThreadStatus: ThreadState['status'] = 'error'; // Default to error

      onThreadsChange(currentGlobalThreads => {
          const targetThreadInUpdate = currentGlobalThreads.find(t => t.id === threadId);
          if (!targetThreadInUpdate || targetThreadInUpdate.status !== 'running') {
              return currentGlobalThreads; 
          }

          const otherThreadsStillRunning = currentGlobalThreads.some(t => t.id !== threadId && t.status === 'running');
          const potentialRaceCondition = acquiredLocksForThisExecution.length === 0 && otherThreadsStillRunning && Math.random() < 0.25;

          if (result.success && !potentialRaceCondition) {
            finalThreadStatus = 'idle'; // MODIFIED: Successful completion now sets status to 'idle'
            finalOutputMessage = `SUCCESS: Thread ${threadId} completed, generated ${result.ticksGenerated} ticks.\nLocks held: ${acquiredLocksForThisExecution.join(', ') || 'none'}\nThread is now idle.`;
          } else {
            if (potentialRaceCondition) {
              finalTicksGenerated = Math.floor(result.ticksGenerated * 0.3);
              finalOutputMessage = `ERROR: Race condition detected in Thread ${threadId}!\nGenerated only ${finalTicksGenerated} ticks. Consider using locks.`;
            } else {
                finalOutputMessage = `ERROR: Thread ${threadId} execution failed.\nGenerated only ${finalTicksGenerated} ticks. Check code or resource conflicts.`;
            }
            // Error status is already set as default for finalThreadStatus
          }
        
          return currentGlobalThreads.map(t => t.id === threadId ? {
            ...t, 
            status: finalThreadStatus, 
            output: finalOutputMessage,
            ticksGeneratedLastRun: finalTicksGenerated
          } : t);
      });
    }, 1000 + Math.random() * 1000);
  }, [
    threadsFromProps,
    runCode,        
    actualMaxMemory,
    totalCodeSize,  
    deadlockDetected,
    onThreadsChange 
  ]);

  const handleRunAllIdleThreads = useCallback(() => {
    if (deadlockDetected || totalCodeSize > actualMaxMemory || idleThreadsCount === 0) {
        return;
    }
    const idleThreadIds = threadsFromProps
        .filter(t => t.status === 'idle') // This correctly targets only idle threads
        .map(t => t.id);
    
    idleThreadIds.forEach((threadId, index) => {
        setTimeout(() => {
            executeSingleThread(threadId);
        }, index * 200); 
    });
  }, [
    threadsFromProps,
    deadlockDetected, 
    totalCodeSize, 
    actualMaxMemory, 
    idleThreadsCount, 
    executeSingleThread
  ]);
  
  const resolveDeadlock = useCallback(() => {
    onThreadsChange(prevThreads => prevThreads.map(t => {
      if (t.status === 'running' || t.acquiredLocks.length > 0) {
        return {...t, status: 'idle', output: 'Thread reset (deadlock). Locks released.', acquiredLocks: []};
      }
      return t;
    }));
    onGlobalLocksChange(() => ({}));
    setDeadlockDetected(false);
  }, [onThreadsChange, onGlobalLocksChange]);

  const handleResetThread = useCallback((threadId: number) => {
    onThreadsChange(prevThreads => prevThreads.map(t => 
      t.id === threadId && t.status === 'error'
        ? { 
            ...t, 
            status: 'idle', 
            output: `// Thread ${threadId} has been reset from error state.`, 
            ticksGeneratedLastRun: 0, 
            acquiredLocks: [] 
          } 
        : t
    ));
    onGlobalLocksChange(prevGlobalLocks => {
        const newGlobalLocks = {...prevGlobalLocks};
        let changed = false;
        const threadToReset = threadsFromProps.find(thr => thr.id === threadId);
        threadToReset?.acquiredLocks.forEach(lockName => {
             if (newGlobalLocks[lockName] === threadId) {
                delete newGlobalLocks[lockName];
                changed = true;
            }
        });
        return changed ? newGlobalLocks : prevGlobalLocks;
    });
  }, [onThreadsChange, onGlobalLocksChange, threadsFromProps]);
  
  return (
    <div className="animate-fadeIn">
      <h3 className="text-xl mb-4 text-accent-primary">Concurrency Layer</h3>
       <div className="bg-background-secondary p-4 rounded border border-border-primary shadow-md mb-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
          <p className="text-text-secondary mb-2 sm:mb-0 text-sm">
            Manage multiple execution threads. Max Threads: {maxThreads}. Idle: {idleThreadsCount}.
            <br /> Total Code Memory: <span className={totalCodeSize > actualMaxMemory ? "text-error-primary" : "text-text-primary"}>{totalCodeSize.toFixed(1)}</span> / {actualMaxMemory.toFixed(0)} CU
          </p>
          <div className="flex flex-wrap gap-2 mt-2 sm:mt-0">
            <button
              onClick={handleRunAllIdleThreads}
              disabled={idleThreadsCount === 0 || deadlockDetected || totalCodeSize > actualMaxMemory}
              title={
                idleThreadsCount === 0 ? "No idle threads to run" :
                deadlockDetected ? "Deadlock detected, resolve first" :
                totalCodeSize > actualMaxMemory ? "Total code memory exceeds capacity" :
                "Run all idle threads"
              }
              className="px-3 py-2 rounded font-semibold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 text-sm"
            >
              Run All Idle ({idleThreadsCount})
            </button>
            <button
              onClick={createNewThread}
              disabled={threadsFromProps.length >= maxThreads || totalCodeSize > actualMaxMemory}
              title={threadsFromProps.length >= maxThreads ? "Max threads reached" : totalCodeSize > actualMaxMemory ? "Not enough memory for new thread code" : "Create new thread"}
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
                  globalLocksFromProps[lock] !== undefined 
                    ? 'bg-red-700 text-gray-200' 
                    : 'bg-green-700 text-gray-200'
                }`}
              >
                {lock} {globalLocksFromProps[lock] !== undefined && `(Held by T${globalLocksFromProps[lock]})`}
              </div>
            ))}
          </div>
        </div>
        
        <div className="space-y-4">
          {threadsFromProps.map(thread => (
            <div key={thread.id} className="bg-gray-900 p-3 rounded border border-border-secondary">
              <div className="flex justify-between items-center mb-2">
                <h5 className="font-medium text-text-primary">Thread {thread.id}</h5>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 text-xs rounded font-semibold ${
                    thread.status === 'idle' ? 'bg-gray-600 text-gray-300' :
                    thread.status === 'running' ? 'bg-yellow-500 text-black animate-pulseOnce' :
                    // 'completed' status will no longer be a persistent state, but for UI flash:
                    // thread.status === 'completed' ? 'bg-green-500 text-black' : 
                    'bg-red-500 text-white' // This will be for 'error'
                  }`}>
                    {thread.status.toUpperCase()}
                  </span>
                  <button 
                    onClick={() => removeThread(thread.id)} 
                    disabled={thread.status === 'running'} 
                    className="text-xs bg-red-700 hover:bg-red-800 text-white px-2 py-1 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                    title={thread.status === 'running' ? "Cannot remove running thread" : "Remove thread"}
                  >
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
                      (globalLocksFromProps[lockName] !== undefined && globalLocksFromProps[lockName] !== thread.id) 
                    }
                    className={`px-2 py-1 text-xs rounded font-medium transition-colors ${
                      thread.acquiredLocks.includes(lockName)
                        ? 'bg-red-600 hover:bg-red-700 text-white'
                        : 'bg-green-600 hover:bg-green-700 text-white'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                    title={
                        thread.status === 'running' ? "Cannot change locks on running thread" :
                        (globalLocksFromProps[lockName] !== undefined && globalLocksFromProps[lockName] !== thread.id) ? `Lock held by Thread ${globalLocksFromProps[lockName]}` :
                        thread.acquiredLocks.includes(lockName) ? `Release ${lockName}` : `Acquire ${lockName}`
                    }
                  >
                    {thread.acquiredLocks.includes(lockName) ? `Release ${lockName}` : `Acquire ${lockName}`}
                  </button>
                ))}
              </div>
              
              <div className="flex justify-end gap-2">
                {thread.status === 'error' && (
                  <button
                    onClick={() => handleResetThread(thread.id)}
                    // disabled is not strictly needed here if only shown for 'error'
                    className="px-3 py-1.5 rounded font-semibold bg-yellow-600 hover:bg-yellow-700 text-black transition-colors duration-150 text-sm"
                    title="Reset this errored thread to idle state"
                  >
                    Reset Thread
                  </button>
                )}
                <button
                  onClick={() => executeSingleThread(thread.id)}
                  disabled={
                    // A thread can be run if it's 'idle'. 'completed' is now effectively 'idle' post-run.
                    thread.status !== 'idle' || 
                    totalCodeSize > actualMaxMemory || 
                    deadlockDetected
                  }
                  title={
                    thread.status === 'error' ? `Thread is in error state. Reset to run again.` :
                    thread.status === 'running' ? `Thread is currently running.` :
                    totalCodeSize > actualMaxMemory ? "Total code memory exceeds capacity" :
                    deadlockDetected ? "Deadlock detected, resolve first" :
                    "Run this thread"
                  }
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