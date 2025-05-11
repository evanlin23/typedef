// src/components/layers/ConcurrencyLayer.tsx
import React, { useEffect, useCallback, useState, useMemo } from 'react';
import { 
  type GameState, 
  type ThreadState,
  type GlobalConcurrencyLocks,
  // calculateActualMaxMemory removed
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

  const { concurrencyThreads, concurrencyGlobalLocks } = gameState.layerSpecificStates;
  const { resources } = gameState; // Destructure resources to get maxMemory

  const availableLocks = useMemo(() => ['shared_data_A', 'shared_buffer_B', 'critical_section_C'], []);
  // Use current maxMemory from gameState.resources directly
  const actualMaxMemory = useMemo(() => resources.maxMemory, [resources.maxMemory]);
  const maxThreads = useMemo(() => calculateMaxThreads(gameState), [gameState]);
  
  const totalCodeSize = useMemo(() => 
    concurrencyThreads.reduce((sum, t) => sum + t.code.length * CODE_COST_HIGHLEVEL_PER_CHAR, 0),
    [concurrencyThreads]
  );
  
  const idleThreadsCount = useMemo(() => 
    concurrencyThreads.filter(t => t.status === 'idle').length,
    [concurrencyThreads]
  );
  
  const runningThreads = useMemo(() => 
    concurrencyThreads.filter(t => t.status === 'running'),
    [concurrencyThreads]
  );

  // Deadlock detection (simplified heuristic)
  useEffect(() => {
    if (runningThreads.length < 2 || Object.keys(concurrencyGlobalLocks).length === 0) {
      setDeadlockDetected(false);
      return;
    }
    
    const threadsWantingLocks = runningThreads.filter(t => 
      t.code.includes('acquireLock') &&
      t.acquiredLocks.length < availableLocks.length
    );

    if (threadsWantingLocks.length === runningThreads.length && threadsWantingLocks.length > 1) {
       if (Math.random() < 0.1 * threadsWantingLocks.length) { 
          setDeadlockDetected(true);
          return;
       }
    }
    setDeadlockDetected(false);
  }, [runningThreads, concurrencyGlobalLocks, availableLocks]);
  
  const createNewThread = useCallback(() => {
    onThreadsChange(prevThreads => {
      if (prevThreads.length >= maxThreads) return prevThreads;
      const newId = prevThreads.length > 0 ? Math.max(0, ...prevThreads.map(t => t.id)) + 1 : 1;
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
    const threadToRemove = concurrencyThreads.find(t => t.id === id);
    if (threadToRemove?.status === 'running') return;

    if (threadToRemove && threadToRemove.acquiredLocks.length > 0) {
      onGlobalLocksChange(prevGlobalLocks => {
        const newGlobalLocks = { ...prevGlobalLocks };
        let changed = false;
        threadToRemove.acquiredLocks.forEach(lockName => {
          if (newGlobalLocks[lockName] === id) {
            delete newGlobalLocks[lockName];
            changed = true;
          }
        });
        return changed ? newGlobalLocks : prevGlobalLocks;
      });
    }
    onThreadsChange(prevThreads => prevThreads.filter(t => t.id !== id));
  }, [concurrencyThreads, onThreadsChange, onGlobalLocksChange]);
  
  const updateThreadCode = useCallback((id: number, newCode: string) => {
    onThreadsChange(prevThreads => prevThreads.map(t => t.id === id ? {...t, code: newCode} : t));
  }, [onThreadsChange]);
  
  const toggleLock = useCallback((threadId: number, lockName: string) => {
    onThreadsChange(prevThreads => {
      const thread = prevThreads.find(t => t.id === threadId);
      if (!thread || thread.status === 'running') return prevThreads;

      let newGlobalLocks = { ...concurrencyGlobalLocks };
      let locksChangedForGlobalState = false;

      const updatedThreads = prevThreads.map(t => {
        if (t.id === threadId) {
          if (t.acquiredLocks.includes(lockName)) {
            if (newGlobalLocks[lockName] === threadId) {
              delete newGlobalLocks[lockName];
              locksChangedForGlobalState = true;
            }
            return {...t, acquiredLocks: t.acquiredLocks.filter(l => l !== lockName)};
          } else { 
            if (newGlobalLocks[lockName] === undefined) { 
              newGlobalLocks[lockName] = threadId;
              locksChangedForGlobalState = true;
              return {...t, acquiredLocks: [...t.acquiredLocks, lockName]};
            } else {
              return t; 
            }
          }
        }
        return t;
      });

      if (locksChangedForGlobalState) {
        onGlobalLocksChange(() => newGlobalLocks);
      }
      return updatedThreads;
    });
  }, [onThreadsChange, onGlobalLocksChange, concurrencyGlobalLocks]);

  const executeSingleThread = useCallback((threadId: number) => {
    const threadToExecute = concurrencyThreads.find(t => t.id === threadId);

    if (!threadToExecute || threadToExecute.status !== 'idle') {
      return;
    }
    if (totalCodeSize > actualMaxMemory) {
      onThreadsChange(prev => prev.map(t => t.id === threadId ? {...t, output: `ERROR: Total thread memory (${totalCodeSize.toFixed(1)} CU) exceeds capacity (${actualMaxMemory.toFixed(0)} CU).`, status: 'error'} : t));
      return;
    }
    if (deadlockDetected) {
      onThreadsChange(prev => prev.map(t => t.id === threadId ? {...t, output: 'ERROR: Deadlock detected! Resolve deadlock or manage locks.', status: 'error'} : t));
      return;
    }

    onThreadsChange(prev => prev.map(t => 
        t.id === threadId ? { ...t, status: 'running', output: '// Executing thread...', ticksGeneratedLastRun: 0 } : t
    ));
    
    const codeForExecution = threadToExecute.code;
    const locksHeldByThisThread = [...threadToExecute.acquiredLocks];

    setTimeout(() => {
      const result = runCode(codeForExecution, 'concurrency', threadId); 
      
      onThreadsChange(currentThreads => {
        const targetThreadAfterRun = currentThreads.find(t => t.id === threadId);
        if (!targetThreadAfterRun || targetThreadAfterRun.status !== 'running') {
          return currentThreads; 
        }

        let finalTicks = result.ticksGenerated;
        let finalOutput = '';
        let finalStatus: ThreadState['status'] = 'error';

        const otherThreadsStillRunning = currentThreads.some(t => t.id !== threadId && t.status === 'running');
        const potentialRaceCondition = locksHeldByThisThread.length === 0 && otherThreadsStillRunning && Math.random() < 0.25;

        if (result.success && !potentialRaceCondition) {
          finalStatus = 'idle';
          finalOutput = `SUCCESS: Thread ${threadId} completed. Generated ${result.ticksGenerated} Ticks.\nLocks held: ${locksHeldByThisThread.join(', ') || 'none'}\nStatus: Idle.`;
        } else {
          if (potentialRaceCondition) {
            finalTicks = Math.floor(result.ticksGenerated * 0.3);
            finalOutput = `ERROR: Race condition detected in Thread ${threadId} execution!\nReduced Ticks: ${finalTicks}. Consider using locks for shared resources.`;
          } else {
            finalOutput = `ERROR: Thread ${threadId} execution failed.\nGenerated only ${finalTicks} Ticks. Review code or resource conflicts.`;
          }
        }
        
        return currentThreads.map(t => t.id === threadId ? {
          ...t, 
          status: finalStatus, 
          output: finalOutput,
          ticksGeneratedLastRun: finalTicks
        } : t);
      });
    }, 1000 + Math.random() * 1000);
  }, [
    concurrencyThreads, runCode, actualMaxMemory, totalCodeSize, 
    deadlockDetected, onThreadsChange
  ]);

  const handleRunAllIdleThreads = useCallback(() => {
    if (idleThreadsCount === 0 || deadlockDetected || totalCodeSize > actualMaxMemory) {
      return;
    }
    const idleThreadIds = concurrencyThreads
        .filter(t => t.status === 'idle')
        .map(t => t.id);
    
    idleThreadIds.forEach((threadId, index) => {
        setTimeout(() => {
            executeSingleThread(threadId);
        }, index * 200); 
    });
  }, [
    concurrencyThreads, idleThreadsCount, deadlockDetected, 
    totalCodeSize, actualMaxMemory, executeSingleThread
  ]);
  
  const resolveDeadlock = useCallback(() => {
    onThreadsChange(prevThreads => prevThreads.map(t => {
      if (t.status === 'running' || t.acquiredLocks.length > 0) {
        return {...t, status: 'idle', output: 'Thread reset due to deadlock resolution. Locks released.', acquiredLocks: []};
      }
      return t;
    }));
    onGlobalLocksChange(() => ({}));
    setDeadlockDetected(false);
  }, [onThreadsChange, onGlobalLocksChange]);

  const handleResetThread = useCallback((threadId: number) => {
    const threadToReset = concurrencyThreads.find(thr => thr.id === threadId);
    if (!threadToReset || threadToReset.status !== 'error') return;

    if (threadToReset.acquiredLocks.length > 0) {
      onGlobalLocksChange(prevGlobalLocks => {
        const newGlobalLocks = {...prevGlobalLocks};
        let changed = false;
        threadToReset.acquiredLocks.forEach(lockName => {
            if (newGlobalLocks[lockName] === threadId) {
              delete newGlobalLocks[lockName];
              changed = true;
            }
        });
        return changed ? newGlobalLocks : prevGlobalLocks;
      });
    }

    onThreadsChange(prevThreads => prevThreads.map(t => 
      t.id === threadId
        ? { ...t, status: 'idle', output: `// Thread ${threadId} reset from error state. Ready.`, ticksGeneratedLastRun: 0, acquiredLocks: [] } 
        : t
    ));
  }, [onThreadsChange, onGlobalLocksChange, concurrencyThreads]);
  
  return (
    <div className="animate-fadeIn">
      <h3 className="text-xl font-semibold mb-4 text-accent-primary">Concurrency & Parallelism Layer</h3>
       <div className="bg-gray-900 p-4 rounded border border-border-secondary shadow-md mb-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
          <div className="text-text-secondary text-sm">
            <p>Manage multiple execution threads. Max Threads: <span className="text-text-primary font-medium">{maxThreads}</span>.</p>
            <p>Idle Threads: <span className="text-text-primary font-medium">{idleThreadsCount}</span>. Running: <span className="text-text-primary font-medium">{runningThreads.length}</span>.</p>
            <p>Total Code Memory: <span className={`${totalCodeSize > actualMaxMemory ? "text-error-primary" : "text-text-primary"} font-medium`}>{totalCodeSize.toFixed(1)}</span> / {actualMaxMemory.toFixed(0)} CU</p>
          </div>
          <div className="flex flex-wrap gap-2 self-start sm:self-center">
            <button
              onClick={handleRunAllIdleThreads}
              disabled={idleThreadsCount === 0 || deadlockDetected || totalCodeSize > actualMaxMemory}
              title={
                idleThreadsCount === 0 ? "No idle threads available to run" :
                deadlockDetected ? "Deadlock detected. Please resolve first." :
                totalCodeSize > actualMaxMemory ? "Total code memory exceeds capacity." :
                "Run all currently idle threads"
              }
              className="px-3 py-2 rounded font-semibold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 text-sm"
            >
              Run All Idle ({idleThreadsCount})
            </button>
            <button
              onClick={createNewThread}
              disabled={concurrencyThreads.length >= maxThreads || totalCodeSize >= actualMaxMemory - (initialConcurrencyThreadCode(0).length * CODE_COST_HIGHLEVEL_PER_CHAR) }
              title={
                concurrencyThreads.length >= maxThreads ? "Maximum number of threads reached." : 
                totalCodeSize >= actualMaxMemory ? "Not enough free memory for a new thread's default code." :
                "Create a new execution thread"
              }
              className="px-3 py-2 rounded font-semibold bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 text-sm"
            >
              Add Thread
            </button>
            {deadlockDetected && (
              <button onClick={resolveDeadlock} className="px-3 py-2 rounded font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors duration-150 text-sm animate-pulseOnce">
                Resolve Deadlock!
              </button>
            )}
          </div>
        </div>

        {deadlockDetected && (
          <div className="bg-red-800 bg-opacity-70 text-red-100 p-3 rounded mb-4 text-sm border border-red-600 shadow-lg">
            <span className="font-bold">⚠️ DEADLOCK DETECTED!</span> Multiple threads are blocked, preventing progress. Use "Resolve Deadlock" or manually manage locks and reset errored threads.
          </div>
        )}

         <div className="mb-4">
          <h4 className="font-medium mb-1 text-text-primary">Global Resource Locks:</h4>
          <div className="flex flex-wrap gap-2">
            {availableLocks.map(lock => (
              <div 
                key={lock}
                title={`Lock status for ${lock}`}
                className={`px-2 py-1 rounded text-xs font-medium border ${
                  concurrencyGlobalLocks[lock] !== undefined 
                    ? 'bg-red-700 text-gray-200 border-red-500' 
                    : 'bg-green-700 text-gray-200 border-green-500'
                }`}
              >
                {lock} {concurrencyGlobalLocks[lock] !== undefined && `(Held by T${concurrencyGlobalLocks[lock]})`}
              </div>
            ))}
          </div>
        </div>
        
        <div className="space-y-4">
          {concurrencyThreads.map(thread => {
            const isRunning = thread.status === 'running';
            const isError = thread.status === 'error';
            const threadCodeCost = thread.code.length * CODE_COST_HIGHLEVEL_PER_CHAR;

            return (
            <div key={thread.id} className="bg-gray-800 p-3 rounded border border-border-primary shadow-sm">
              <div className="flex justify-between items-center mb-2">
                <h5 className="font-medium text-text-primary">Thread {thread.id} <span className="text-xs text-text-secondary">(Cost: {threadCodeCost.toFixed(1)} CU)</span></h5>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 text-xs rounded-full font-semibold ${
                    thread.status === 'idle' ? 'bg-gray-600 text-gray-300' :
                    isRunning ? 'bg-yellow-500 text-black animate-pulseOnce' :
                    isError ? 'bg-red-500 text-white' :
                    'bg-blue-500 text-white'
                  }`}>
                    {thread.status.toUpperCase()}
                  </span>
                  <button 
                    onClick={() => removeThread(thread.id)} 
                    disabled={isRunning} 
                    className="text-xs bg-red-700 hover:bg-red-800 text-white px-2 py-1 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                    title={isRunning ? "Cannot remove a running thread" : "Remove this thread"}
                    aria-label={`Remove Thread ${thread.id}`}
                  >
                    ✕
                  </button>
                </div>
              </div>
              
              <div className="flex flex-col md:flex-row gap-3 mb-2">
                <div className="md:w-1/2">
                   <label htmlFor={`thread-code-${thread.id}`} className="block text-xs font-medium text-text-secondary mb-1">Code (Thread {thread.id}):</label>
                  <textarea
                    id={`thread-code-${thread.id}`}
                    value={thread.code}
                    onChange={(e) => updateThreadCode(thread.id, e.target.value)}
                    disabled={isRunning}
                    className="w-full h-40 bg-gray-900 text-gray-100 p-2 rounded border border-border-secondary font-mono text-xs focus:ring-1 focus:ring-accent-primary focus:border-accent-primary resize-none"
                    spellCheck="false"
                    aria-label={`Code editor for Thread ${thread.id}`}
                  />
                </div>
                <div className="md:w-1/2">
                  <label htmlFor={`thread-output-${thread.id}`} className="block text-xs font-medium text-text-secondary mb-1">Output:</label>
                  <div 
                    id={`thread-output-${thread.id}`}
                    className="w-full h-40 bg-gray-900 text-gray-100 p-2 rounded border border-border-secondary font-mono text-xs overflow-auto whitespace-pre-wrap"
                    aria-live="polite"
                  >
                    {thread.output || "// Output will appear here"}
                  </div>
                </div>
              </div>
              
              <div className="text-xs text-text-secondary mb-2">
                Locks Acquired by this Thread: {thread.acquiredLocks.join(', ') || 'None'}
              </div>
              <div className="flex flex-wrap gap-2 mb-3">
                {availableLocks.map(lockName => {
                  const lockHeldByOther = concurrencyGlobalLocks[lockName] !== undefined && concurrencyGlobalLocks[lockName] !== thread.id;
                  const canToggle = !isRunning && !lockHeldByOther;
                  return (
                  <button
                    key={lockName}
                    onClick={() => toggleLock(thread.id, lockName)}
                    disabled={!canToggle}
                    className={`px-2 py-1 text-xs rounded font-medium transition-colors border ${
                      thread.acquiredLocks.includes(lockName)
                        ? 'bg-red-600 hover:bg-red-700 text-white border-red-500'
                        : 'bg-green-600 hover:bg-green-700 text-white border-green-500'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                    title={
                        isRunning ? "Cannot change locks on a running thread." :
                        lockHeldByOther ? `Lock '${lockName}' is currently held by Thread ${concurrencyGlobalLocks[lockName]}.` :
                        thread.acquiredLocks.includes(lockName) ? `Release lock '${lockName}'` : `Acquire lock '${lockName}'`
                    }
                  >
                    {thread.acquiredLocks.includes(lockName) ? `Release ${lockName}` : `Acquire ${lockName}`}
                  </button>
                )})}
              </div>
              
              <div className="flex flex-wrap justify-end gap-2">
                {isError && (
                  <button
                    onClick={() => handleResetThread(thread.id)}
                    className="px-3 py-1.5 rounded font-semibold bg-yellow-600 hover:bg-yellow-700 text-black transition-colors duration-150 text-sm"
                    title="Reset this errored thread to an idle state and release its locks"
                  >
                    Reset Thread
                  </button>
                )}
                <button
                  onClick={() => executeSingleThread(thread.id)}
                  disabled={
                    isRunning || isError ||
                    totalCodeSize > actualMaxMemory || 
                    deadlockDetected
                  }
                  title={
                    isRunning ? "Thread is currently running." :
                    isError ? "Thread is in an error state. Reset to run again." :
                    totalCodeSize > actualMaxMemory ? "Total code memory for threads exceeds capacity." :
                    deadlockDetected ? "Deadlock detected system-wide. Please resolve first." :
                    "Run this thread"
                  }
                  className="px-3 py-1.5 rounded font-semibold bg-accent-primary hover:bg-green-600 text-black disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 text-sm"
                >
                  Run Thread
                </button>
              </div>
              
              {thread.ticksGeneratedLastRun > 0 && thread.status !== 'running' && (
                <div className="mt-1 text-xs text-green-400">
                  Last run generated: {thread.ticksGeneratedLastRun} Ticks.
                </div>
              )}
            </div>
          )})}
        </div>
      </div>
    </div>
  );
};

export default ConcurrencyLayer;