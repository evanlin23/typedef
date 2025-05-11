// src/components/layers/ConcurrencyLayer.tsx
import React, { useEffect, useCallback, useState, useMemo } from 'react';
import { useGameContext } from '../../contexts/GameContext'; // ** Import useGameContext **
import { 
  type ThreadState, // Keep for type hints
  // type GlobalConcurrencyLocks, // Keep for type hints
  calculateMaxThreads, 
  CODE_COST_HIGHLEVEL_PER_CHAR,
  initialConcurrencyThreadCode 
} from '../../types/gameState';

import ConcurrencyControls from './concurrency/ConcurrencyControls';
import GlobalLockDisplay from './concurrency/GlobalLockDisplay';
import ThreadList from './concurrency/ThreadList';

const ConcurrencyLayer: React.FC = () => {
  const { 
    gameState, 
    runCode,
    handleConcurrencyThreadsChange,   // ** Use from context **
    handleConcurrencyGlobalLocksChange // ** Use from context **
  } = useGameContext();

  const [deadlockDetected, setDeadlockDetected] = useState<boolean>(false);

  const { concurrencyThreads, concurrencyGlobalLocks } = gameState.layerSpecificStates;
  const { resources } = gameState;

  const availableLocks = useMemo(() => ['shared_data_A', 'shared_buffer_B', 'critical_section_C'], []);
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
    // ** Use handleConcurrencyThreadsChange from context **
    handleConcurrencyThreadsChange(prevThreads => {
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
  }, [maxThreads, handleConcurrencyThreadsChange]);
  
  const removeThread = useCallback((id: number) => {
    const threadToRemove = concurrencyThreads.find(t => t.id === id);
    if (threadToRemove?.status === 'running') return;
    if (threadToRemove && threadToRemove.acquiredLocks.length > 0) {
      // ** Use handleConcurrencyGlobalLocksChange from context **
      handleConcurrencyGlobalLocksChange(prevGlobalLocks => {
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
    // ** Use handleConcurrencyThreadsChange from context **
    handleConcurrencyThreadsChange(prevThreads => prevThreads.filter(t => t.id !== id));
  }, [concurrencyThreads, handleConcurrencyThreadsChange, handleConcurrencyGlobalLocksChange]);
  
  const updateThreadCode = useCallback((id: number, newCode: string) => {
    // ** Use handleConcurrencyThreadsChange from context **
    handleConcurrencyThreadsChange(prevThreads => prevThreads.map(t => t.id === id ? {...t, code: newCode} : t));
  }, [handleConcurrencyThreadsChange]);
  
  const toggleLock = useCallback((threadId: number, lockName: string) => {
    // ** Use handleConcurrencyThreadsChange from context **
    handleConcurrencyThreadsChange(prevThreads => {
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
            } else { return t; }
          }
        }
        return t;
      });
      if (locksChangedForGlobalState) {
        // ** Use handleConcurrencyGlobalLocksChange from context **
        handleConcurrencyGlobalLocksChange(() => newGlobalLocks);
      }
      return updatedThreads;
    });
  }, [handleConcurrencyThreadsChange, handleConcurrencyGlobalLocksChange, concurrencyGlobalLocks]);

  const executeSingleThread = useCallback((threadId: number) => {
    const threadToExecute = concurrencyThreads.find(t => t.id === threadId);
    if (!threadToExecute || threadToExecute.status !== 'idle') return;
    if (totalCodeSize > actualMaxMemory) {
      handleConcurrencyThreadsChange(prev => prev.map(t => t.id === threadId ? {...t, output: `ERROR: Total thread memory (${totalCodeSize.toFixed(1)} CU) exceeds capacity (${actualMaxMemory.toFixed(0)} CU).`, status: 'error'} : t));
      return;
    }
    if (deadlockDetected) {
      handleConcurrencyThreadsChange(prev => prev.map(t => t.id === threadId ? {...t, output: 'ERROR: Deadlock detected! Resolve deadlock or manage locks.', status: 'error'} : t));
      return;
    }
    handleConcurrencyThreadsChange(prev => prev.map(t => 
        t.id === threadId ? { ...t, status: 'running', output: '// Executing thread...', ticksGeneratedLastRun: 0 } : t
    ));
    const codeForExecution = threadToExecute.code;
    const locksHeldByThisThread = [...threadToExecute.acquiredLocks];
    setTimeout(() => {
      const result = runCode(codeForExecution, 'concurrency', threadId); // runCode from context
      handleConcurrencyThreadsChange(currentThreads => {
        const targetThreadAfterRun = currentThreads.find(t => t.id === threadId);
        if (!targetThreadAfterRun || targetThreadAfterRun.status !== 'running') return currentThreads; 
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
          ...t, status: finalStatus, output: finalOutput, ticksGeneratedLastRun: finalTicks
        } : t);
      });
    }, 1000 + Math.random() * 1000);
  }, [concurrencyThreads, runCode, actualMaxMemory, totalCodeSize, deadlockDetected, handleConcurrencyThreadsChange]);

  const handleRunAllIdleThreads = useCallback(() => {
    if (idleThreadsCount === 0 || deadlockDetected || totalCodeSize > actualMaxMemory) return;
    const idleThreadIds = concurrencyThreads.filter(t => t.status === 'idle').map(t => t.id);
    idleThreadIds.forEach((threadId, index) => {
        setTimeout(() => executeSingleThread(threadId), index * 200); 
    });
  }, [concurrencyThreads, idleThreadsCount, deadlockDetected, totalCodeSize, actualMaxMemory, executeSingleThread]);
  
  const resolveDeadlock = useCallback(() => {
    handleConcurrencyThreadsChange(prevThreads => prevThreads.map(t => {
      if (t.status === 'running' || t.acquiredLocks.length > 0) {
        return {...t, status: 'idle', output: 'Thread reset due to deadlock resolution. Locks released.', acquiredLocks: []};
      }
      return t;
    }));
    handleConcurrencyGlobalLocksChange(() => ({}));
    setDeadlockDetected(false);
  }, [handleConcurrencyThreadsChange, handleConcurrencyGlobalLocksChange]);

  const handleResetThread = useCallback((threadId: number) => {
    const threadToReset = concurrencyThreads.find(thr => thr.id === threadId);
    if (!threadToReset || threadToReset.status !== 'error') return;
    if (threadToReset.acquiredLocks.length > 0) {
      handleConcurrencyGlobalLocksChange(prevGlobalLocks => {
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
    handleConcurrencyThreadsChange(prevThreads => prevThreads.map(t => 
      t.id === threadId
        ? { ...t, status: 'idle', output: `// Thread ${threadId} reset from error state. Ready.`, ticksGeneratedLastRun: 0, acquiredLocks: [] } 
        : t
    ));
  }, [handleConcurrencyThreadsChange, handleConcurrencyGlobalLocksChange, concurrencyThreads]);
  
  return (
    <div className="animate-fadeIn">
      <h3 className="text-xl font-semibold mb-4 text-accent-primary">Concurrency & Parallelism Layer</h3>
      <div className="bg-gray-900 p-4 rounded border border-border-secondary shadow-md mb-4">
        <ConcurrencyControls
          maxThreads={maxThreads}
          currentThreadCount={concurrencyThreads.length}
          idleThreadsCount={idleThreadsCount}
          runningThreadsCount={runningThreads.length}
          totalCodeSize={totalCodeSize}
          actualMaxMemory={actualMaxMemory}
          deadlockDetected={deadlockDetected}
          onRunAllIdleThreads={handleRunAllIdleThreads}
          onCreateNewThread={createNewThread}
          onResolveDeadlock={resolveDeadlock}
        />

        {deadlockDetected && (
          <div className="bg-red-800 bg-opacity-70 text-red-100 p-3 rounded mb-4 text-sm border border-red-600 shadow-lg">
            <span className="font-bold">⚠️ DEADLOCK DETECTED!</span> Multiple threads are blocked, preventing progress. Use "Resolve Deadlock" or manually manage locks and reset errored threads.
          </div>
        )}

        <GlobalLockDisplay
          availableLocks={availableLocks}
          globalLocks={concurrencyGlobalLocks}
        />
        
        {/* ** ThreadList now uses context implicitly for child ThreadItem if needed, or pass specific props directly ** */}
        {/* ** For now, ThreadList mainly organizes ThreadItems which take specific handlers ** */}
        <ThreadList
          threads={concurrencyThreads}
          availableLocks={availableLocks}
          globalLocks={concurrencyGlobalLocks}
          totalCodeSize={totalCodeSize}
          actualMaxMemory={actualMaxMemory}
          deadlockDetected={deadlockDetected}
          onUpdateCode={updateThreadCode}
          onToggleLock={toggleLock}
          onExecute={executeSingleThread}
          onRemove={removeThread}
          onReset={handleResetThread}
        />
      </div>
    </div>
  );
};

export default ConcurrencyLayer;