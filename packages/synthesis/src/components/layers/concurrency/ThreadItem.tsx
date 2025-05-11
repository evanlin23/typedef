// src/components/layers/concurrency/ThreadItem.tsx
// This component receives specific handlers as props from ThreadList/ConcurrencyLayer.
// It doesn't need to access the full GameContext directly if its parent orchestrates.
import React from 'react';
import { 
    type ThreadState, 
    type GlobalConcurrencyLocks, 
    CODE_COST_HIGHLEVEL_PER_CHAR 
} from '../../../types/gameState';

interface ThreadItemProps {
  thread: ThreadState;
  availableLocks: string[];
  globalLocks: GlobalConcurrencyLocks;
  totalCodeSize: number;
  actualMaxMemory: number;
  deadlockDetected: boolean;

  onUpdateCode: (threadId: number, newCode: string) => void;
  onToggleLock: (threadId: number, lockName: string) => void;
  onExecute: (threadId: number) => void;
  onRemove: (threadId: number) => void;
  onReset: (threadId: number) => void;
}

const ThreadItem: React.FC<ThreadItemProps> = React.memo(({
  thread,
  availableLocks,
  globalLocks,
  totalCodeSize,
  actualMaxMemory,
  deadlockDetected,
  onUpdateCode,
  onToggleLock,
  onExecute,
  onRemove,
  onReset,
}) => {
  const isRunning = thread.status === 'running';
  const isError = thread.status === 'error';
  const threadCodeCost = thread.code.length * CODE_COST_HIGHLEVEL_PER_CHAR;

  return (
    <div className="bg-gray-800 p-3 rounded border border-border-primary shadow-sm">
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
            onClick={() => onRemove(thread.id)} 
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
            onChange={(e) => onUpdateCode(thread.id, e.target.value)}
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
          const lockHeldByOther = globalLocks[lockName] !== undefined && globalLocks[lockName] !== thread.id;
          const canToggle = !isRunning && !lockHeldByOther;
          return (
          <button
            key={lockName}
            onClick={() => onToggleLock(thread.id, lockName)}
            disabled={!canToggle}
            className={`px-2 py-1 text-xs rounded font-medium transition-colors border ${
              thread.acquiredLocks.includes(lockName)
                ? 'bg-red-600 hover:bg-red-700 text-white border-red-500'
                : 'bg-green-600 hover:bg-green-700 text-white border-green-500'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            title={
                isRunning ? "Cannot change locks on a running thread." :
                lockHeldByOther ? `Lock '${lockName}' is currently held by Thread ${globalLocks[lockName]}.` :
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
            onClick={() => onReset(thread.id)}
            className="px-3 py-1.5 rounded font-semibold bg-yellow-600 hover:bg-yellow-700 text-black transition-colors duration-150 text-sm"
            title="Reset this errored thread to an idle state and release its locks"
          >
            Reset Thread
          </button>
        )}
        <button
          onClick={() => onExecute(thread.id)}
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
  );
});
ThreadItem.displayName = 'ThreadItem'; // Add display name for React.memo component

export default ThreadItem;