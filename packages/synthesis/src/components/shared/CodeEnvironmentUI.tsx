// src/components/shared/CodeEnvironmentUI.tsx
import React from 'react';

interface CodeEnvironmentUIProps {
  layerKey: string; // e.g., 'assembly' or 'highLevel' for unique IDs
  code: string;
  onCodeChange: (newCode: string) => void;
  output: string;
  codeLabel: string;
  outputLabel: string;
  memoryCost: number;
  maxMemory: number;
  canExecute: boolean;
  isTextareaDisabled?: boolean;
}

const CodeEnvironmentUI: React.FC<CodeEnvironmentUIProps> = ({
  layerKey,
  code,
  onCodeChange,
  output,
  codeLabel,
  outputLabel,
  memoryCost,
  maxMemory,
  canExecute,
  isTextareaDisabled = false,
}) => {
  return (
    <div className="flex flex-col md:flex-row gap-4">
      {/* Code Editor Section */}
      <div className="md:w-1/2 flex flex-col">
        <div className="mb-2 flex justify-between items-center">
          <label htmlFor={`${layerKey}-code-editor`} className="font-medium text-text-primary">{codeLabel}:</label>
          <span
            className={`text-xs font-mono ${!canExecute ? "text-error-primary" : "text-text-secondary"}`}
            title={`Memory: ${memoryCost.toFixed(1)} CU used / ${maxMemory.toFixed(0)} CU max`}
          >
            {memoryCost.toFixed(1)} / {maxMemory.toFixed(0)} CU
          </span>
        </div>
        <textarea
          id={`${layerKey}-code-editor`}
          value={code}
          onChange={(e) => onCodeChange(e.target.value)}
          className="flex-grow w-full h-64 md:h-auto bg-gray-800 text-gray-100 p-2 rounded border border-border-primary font-mono text-sm focus:ring-1 focus:ring-accent-primary focus:border-accent-primary resize-none"
          spellCheck="false"
          aria-label={`${codeLabel} Editor`}
          disabled={isTextareaDisabled}
        />
      </div>

      {/* Output Section */}
      <div className="md:w-1/2 flex flex-col">
        <label htmlFor={`${layerKey}-output-display`} className="block mb-2 font-medium text-text-primary">{outputLabel}:</label>
        <div
          id={`${layerKey}-output-display`}
          className="flex-grow w-full h-64 md:h-auto bg-gray-800 text-gray-100 p-2 rounded border border-border-primary font-mono text-sm overflow-auto whitespace-pre-wrap"
          aria-live="polite"
        >
          {output}
        </div>
      </div>
    </div>
  );
};

export default CodeEnvironmentUI;