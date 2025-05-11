// src/components/layers/ConcurrencyLayer.tsx
import { useState, useEffect } from 'react';

interface ConcurrencyLayerProps {
  runCode: (code: string) => { success: boolean; ticksGenerated: number };
  maxMemory: number;
  maxThreads: number;
}

interface Thread {
  id: number;
  code: string;
  status: 'idle' | 'running' | 'completed' | 'error';
  output: string;
  ticksGenerated: number;
  locks: string[];
}

const ConcurrencyLayer = ({ runCode, maxMemory, maxThreads }: ConcurrencyLayerProps) => {
  const [threads, setThreads] = useState<Thread[]>([
    {
      id: 1,
      code: '// Thread 1\nfunction process() {\n  let data = 0;\n  for (let i = 0; i < 5; i++) {\n    data += i;\n  }\n  return data;\n}\n\nprocess();',
      status: 'idle',
      output: '',
      ticksGenerated: 0,
      locks: []
    }
  ]);
  
  const [availableLocks, setAvailableLocks] = useState<string[]>(['resource_A', 'resource_B', 'resource_C']);
  const [acquiredLocks, setAcquiredLocks] = useState<{[key: string]: number}>({});
  const [activeThreads, setActiveThreads] = useState<number>(0);
  const [deadlockDetected, setDeadlockDetected] = useState<boolean>(false);
  
  useEffect(() => {
    // Check for deadlocks (simplified version)
    if (activeThreads > 0 && Object.keys(acquiredLocks).length > 0) {
      const deadlockCheck = Math.random() < 0.1 && threads.some(t => 
        t.status === 'running' && t.locks.length > 0 && t.locks.some(lock => 
          acquiredLocks[lock] !== t.id && acquiredLocks[lock] !== undefined
        )
      );
      
      setDeadlockDetected(deadlockCheck);
    } else {
      setDeadlockDetected(false);
    }
  }, [threads, acquiredLocks, activeThreads]);
  
  const createNewThread = () => {
    if (threads.length >= maxThreads) return;
    
    const newId = Math.max(...threads.map(t => t.id)) + 1;
    setThreads([...threads, {
      id: newId,
      code: `// Thread ${newId}\nfunction process() {\n  let data = 0;\n  for (let i = 0; i < 5; i++) {\n    data += i;\n  }\n  return data;\n}\n\nprocess();`,
      status: 'idle',
      output: '',
      ticksGenerated: 0,
      locks: []
    }]);
  };
  
  const removeThread = (id: number) => {
    // Release any locks held by this thread
    const threadLocks = threads.find(t => t.id === id)?.locks || [];
    const newAcquiredLocks = {...acquiredLocks};
    
    threadLocks.forEach(lock => {
      if (newAcquiredLocks[lock] === id) {
        delete newAcquiredLocks[lock];
      }
    });
    
    setAcquiredLocks(newAcquiredLocks);
    setThreads(threads.filter(t => t.id !== id));
    setActiveThreads(prev => prev - (threads.find(t => t.id === id)?.status === 'running' ? 1 : 0));
  };
  
  const updateThreadCode = (id: number, newCode: string) => {
    setThreads(threads.map(t => 
      t.id === id ? {...t, code: newCode} : t
    ));
  };
  
  const acquireLock = (threadId: number, lockName: string) => {
    if (acquiredLocks[lockName] !== undefined) return false;
    
    setAcquiredLocks({...acquiredLocks, [lockName]: threadId});
    setThreads(threads.map(t => 
      t.id === threadId ? {...t, locks: [...t.locks, lockName]} : t
    ));
    
    return true;
  };
  
  const releaseLock = (threadId: number, lockName: string) => {
    if (acquiredLocks[lockName] !== threadId) return false;
    
    const newAcquiredLocks = {...acquiredLocks};
    delete newAcquiredLocks[lockName];
    
    setAcquiredLocks(newAcquiredLocks);
    setThreads(threads.map(t => 
      t.id === threadId ? {...t, locks: t.locks.filter(l => l !== lockName)} : t
    ));
    
    return true;
  };
  
  const executeThread = (threadId: number) => {
    const thread = threads.find(t => t.id === threadId);
    if (!thread) return;
    
    // Check if code exceeds memory
    const totalCodeSize = threads.reduce((sum, t) => sum + t.code.length, 0);
    if (totalCodeSize > maxMemory * 20) {
      setThreads(threads.map(t => 
        t.id === threadId ? {...t, status: 'error', output: 'ERROR: Memory capacity exceeded'} : t
      ));
      return;
    }
    
    // Check if there's a deadlock
    if (deadlockDetected) {
      setThreads(threads.map(t => 
        t.status === 'running' ? {...t, status: 'error', output: 'ERROR: Deadlock detected! Thread execution halted.'} : t
      ));
      setDeadlockDetected(false);
      setActiveThreads(0);
      return;
    }
    
    // Simulate thread execution
    setThreads(threads.map(t => 
      t.id === threadId ? {...t, status: 'running'} : t
    ));
    setActiveThreads(prev => prev + 1);
    
    // Simulate async execution
    setTimeout(() => {
      const result = runCode(thread.code);
      
      // Check for race conditions (simulated)
      const hasRaceCondition = thread.locks.length === 0 && Math.random() < 0.3 && activeThreads > 1;
      
      if (result.success && !hasRaceCondition) {
        setThreads(threads.map(t => 
          t.id === threadId ? {
            ...t, 
            status: 'completed', 
            output: `SUCCESS: Generated ${result.ticksGenerated} ticks\n\n// Execution result:\nThread ${threadId} completed successfully.\nLocks held: ${t.locks.join(', ') || 'none'}`,
            ticksGenerated: result.ticksGenerated
          } : t
        ));
      } else {
        const errorMessage = hasRaceCondition 
          ? `ERROR: Race condition detected!\nGenerated only ${result.ticksGenerated * 0.3} ticks\n\n// Debug info:\nShared resource accessed simultaneously\nData corruption detected\nRace condition at line ${Math.floor(Math.random() * thread.code.split('\n').length) + 1}`
          : `ERROR: Thread execution failed\nGenerated only ${result.ticksGenerated} ticks\n\n// Debug info:\nError at line ${Math.floor(Math.random() * thread.code.split('\n').length) + 1}\nThread synchronization issue\nMemory leak detected`;
        
        setThreads(threads.map(t => 
          t.id === threadId ? {
            ...t, 
            status: 'error', 
            output: errorMessage,
            ticksGenerated: hasRaceCondition ? Math.floor(result.ticksGenerated * 0.3) : result.ticksGenerated
          } : t
        ));
      }
      
      setActiveThreads(prev => prev - 1);
    }, 1500);
  };
  
  const resolveDeadlock = () => {
    // Reset all threads that are in deadlock
    setThreads(threads.map(t => 
      t.status === 'running' ? {...t, status: 'idle', locks: []} : t
    ));
    
    // Clear all acquired locks
    setAcquiredLocks({});
    setDeadlockDetected(false);
    setActiveThreads(0);
  };
  
  return (
    <div>
      <h3 className="text-xl mb-4 text-green-400">Concurrency Layer</h3>
      
      <div className="bg-gray-900 p-4 rounded border border-gray-700 mb-4">
        <div className="flex justify-between items-center mb-4">
          <p>
            The Concurrency Layer allows you to run multiple threads simultaneously to generate ticks faster, 
            but introduces risks of race conditions and deadlocks.
          </p>
          
          <div>
            <button
              onClick={createNewThread}
              disabled={threads.length >= maxThreads}
              className="bg-green-400 text-white px-3 py-1 rounded mr-2 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create Thread
            </button>
            
            {deadlockDetected && (
              <button
                onClick={resolveDeadlock}
                className="bg-red-400 text-white px-3 py-1 rounded hover:bg-red-600"
              >
                Resolve Deadlock
              </button>
            )}
          </div>
        </div>
        
        {deadlockDetected && (
          <div className="bg-red-800 text-white p-2 rounded mb-4">
            ⚠️ DEADLOCK DETECTED! Threads are waiting for each other's resources. Use "Resolve Deadlock" to fix.
          </div>
        )}
        
        <div className="mb-4">
          <h4 className="font-medium mb-2">Available Locks:</h4>
          <div className="flex flex-wrap gap-2">
            {availableLocks.map(lock => (
              <div 
                key={lock}
                className={`px-2 py-1 rounded-md text-sm ${
                  acquiredLocks[lock] !== undefined 
                    ? 'bg-red-800 text-gray-200' 
                    : 'bg-green-800 text-gray-200'
                }`}
              >
                {lock} {acquiredLocks[lock] !== undefined && `(Thread ${acquiredLocks[lock]})`}
              </div>
            ))}
          </div>
        </div>
        
        <div className="space-y-4">
          {threads.map(thread => (
            <div key={thread.id} className="bg-gray-800 p-3 rounded">
              <div className="flex justify-between mb-2">
                <h5 className="font-medium">Thread {thread.id}</h5>
                <div className="flex gap-2">
                  <span className={`px-2 py-0.5 text-xs rounded ${
                    thread.status === 'idle' ? 'bg-gray-600 text-gray-200' :
                    thread.status === 'running' ? 'bg-yellow-500 text-gray-900' :
                    thread.status === 'completed' ? 'bg-green-500 text-gray-900' :
                    'bg-red-500 text-gray-900'
                  }`}>
                    {thread.status.toUpperCase()}
                  </span>
                  
                  <button
                    onClick={() => removeThread(thread.id)}
                    className="bg-gray-600 text-white px-2 py-0.5 text-xs rounded hover:bg-gray-500"
                  >
                    X
                  </button>
                </div>
              </div>
              
              <div className="flex flex-col md:flex-row gap-4">
                <div className="md:w-1/2">
                  <textarea
                    value={thread.code}
                    onChange={(e) => updateThreadCode(thread.id, e.target.value)}
                    disabled={thread.status === 'running'}
                    className="w-full h-40 bg-gray-900 text-gray-200 p-2 rounded border border-gray-700 font-mono text-sm"
                  />
                </div>
                
                <div className="md:w-1/2">
                  <div className="w-full h-40 bg-gray-900 text-gray-200 p-2 rounded border border-gray-700 font-mono text-sm overflow-auto whitespace-pre-wrap">
                    {thread.output || "// Output will appear here"}
                  </div>
                </div>
              </div>
              
              <div className="mt-2 flex justify-between">
                <div className="flex gap-2">
                  {availableLocks.map(lock => (
                    <button
                      key={lock}
                      onClick={() => thread.locks.includes(lock) 
                        ? releaseLock(thread.id, lock) 
                        : acquireLock(thread.id, lock)
                      }
                      disabled={
                        thread.status === 'running' || 
                        (acquiredLocks[lock] !== undefined && acquiredLocks[lock] !== thread.id)
                      }
                      className={`px-2 py-1 text-xs rounded ${
                        thread.locks.includes(lock)
                          ? 'bg-red-600 text-white hover:bg-red-700'
                          : 'bg-green-600 text-white hover:bg-green-700'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {thread.locks.includes(lock) ? `Release ${lock}` : `Acquire ${lock}`}
                    </button>
                  ))}
                </div>
                
                <button
                  onClick={() => executeThread(thread.id)}
                  disabled={thread.status === 'running'}
                  className="bg-green-400 text-white px-3 py-1 rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Run Thread
                </button>
              </div>
              
              {thread.ticksGenerated > 0 && (
                <div className="mt-1 text-sm text-green-400">
                  Ticks generated: {thread.ticksGenerated}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      
      <div className="bg-gray-900 p-4 rounded border border-gray-700">
        <h4 className="font-semibold mb-2">Concurrency Reference</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
          <div>
            <span className="font-mono">Acquire Resource</span> - Lock a resource for exclusive access
          </div>
          <div>
            <span className="font-mono">Release Resource</span> - Release a locked resource
          </div>
          <div>
            <span className="font-mono">Race Condition</span> - Occurs when threads access shared data simultaneously
          </div>
          <div>
            <span className="font-mono">Deadlock</span> - Occurs when threads wait for resources held by each other
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConcurrencyLayer;