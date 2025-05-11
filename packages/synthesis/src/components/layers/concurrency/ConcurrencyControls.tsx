// src/components/layers/concurrency/ConcurrencyControls.tsx
// This component is largely presentational and receives its data/callbacks as props.
// No direct context usage is strictly necessary here if parent (ConcurrencyLayer) manages interactions.
// If it were to directly interact with global state (e.g., showing global ticks for a cost), it would use context.
// For this refactor, it remains as is, taking props.
import React from 'react';
import { CODE_COST_HIGHLEVEL_PER_CHAR, initialConcurrencyThreadCode } from '../../../types/gameState';

interface ConcurrencyControlsProps {
  maxThreads: number;
  currentThreadCount: number;
  idleThreadsCount: number;
  runningThreadsCount: number;
  totalCodeSize: number;
  actualMaxMemory: number;
  deadlockDetected: boolean;
  onRunAllIdleThreads: () => void;
  onCreateNewThread: () => void;
  onResolveDeadlock: () => void;
}

const ConcurrencyControls: React.FC<ConcurrencyControlsProps> = ({
  maxThreads,
  currentThreadCount,
  idleThreadsCount,
  runningThreadsCount,
  totalCodeSize,
  actualMaxMemory,
  deadlockDetected,
  onRunAllIdleThreads,
  onCreateNewThread,
  onResolveDeadlock,
}) => {
  const newThreadMemoryEstimate = initialConcurrencyThreadCode(0).length * CODE_COST_HIGHLEVEL_PER_CHAR;
  const canCreateThread = currentThreadCount < maxThreads && (totalCodeSize + newThreadMemoryEstimate) <= actualMaxMemory;

  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
      <div className="text-text-secondary text-sm">
        <p>Manage multiple execution threads. Max Threads: <span className="text-text-primary font-medium">{maxThreads}</span>.</p>
        <p>Idle Threads: <span className="text-text-primary font-medium">{idleThreadsCount}</span>. Running: <span className="text-text-primary font-medium">{runningThreadsCount}</span>.</p>
        <p>Total Code Memory: <span className={`${totalCodeSize > actualMaxMemory ? "text-error-primary" : "text-text-primary"} font-medium`}>{totalCodeSize.toFixed(1)}</span> / {actualMaxMemory.toFixed(0)} CU</p>
      </div>
      <div className="flex flex-wrap gap-2 self-start sm:self-center">
        <button
          onClick={onRunAllIdleThreads}
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
          onClick={onCreateNewThread}
          disabled={!canCreateThread}
          title={
            currentThreadCount >= maxThreads ? "Maximum number of threads reached." : 
            (totalCodeSize + newThreadMemoryEstimate) > actualMaxMemory ? "Not enough free memory for a new thread's default code." :
            "Create a new execution thread"
          }
          className="px-3 py-2 rounded font-semibold bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 text-sm"
        >
          Add Thread
        </button>
        {deadlockDetected && (
          <button onClick={onResolveDeadlock} className="px-3 py-2 rounded font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors duration-150 text-sm animate-pulseOnce">
            Resolve Deadlock!
          </button>
        )}
      </div>
    </div>
  );
};

export default ConcurrencyControls;