// src/components/layers/concurrency/ThreadList.tsx
import React from 'react';
import { type ThreadState, type GlobalConcurrencyLocks } from '../../../types/gameState';
import ThreadItem from './ThreadItem';

interface ThreadListProps {
  threads: ThreadState[];
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

const ThreadList: React.FC<ThreadListProps> = (props) => {
  if (props.threads.length === 0) {
    return (
      <p className="text-text-secondary text-center py-4">
        No active threads. Click "Add Thread" to create one.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {props.threads.map(thread => (
        <ThreadItem
          key={thread.id}
          thread={thread}
          availableLocks={props.availableLocks}
          globalLocks={props.globalLocks}
          totalCodeSize={props.totalCodeSize}
          actualMaxMemory={props.actualMaxMemory}
          deadlockDetected={props.deadlockDetected}
          onUpdateCode={props.onUpdateCode}
          onToggleLock={props.onToggleLock}
          onExecute={props.onExecute}
          onRemove={props.onRemove}
          onReset={props.onReset}
        />
      ))}
    </div>
  );
};

export default ThreadList;