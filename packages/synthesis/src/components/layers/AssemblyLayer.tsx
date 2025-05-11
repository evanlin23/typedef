// src/components/layers/AssemblyLayer.tsx
import React, { useCallback } from 'react';
// Remove calculateActualMaxMemory import, use gameState.resources.maxMemory directly
import { type GameState, CODE_COST_ASSEMBLY_PER_CHAR } from '../../types/gameState';

interface AssemblyLayerProps {
  gameState: GameState;
  runCode: (code: string, layer: string) => { success: boolean; ticksGenerated: number };
  runUnitTests: (layer: string) => void;
  onCodeChange: (newCode: string) => void;
  onOutputSet: (newOutput: string) => void;
}

const AssemblyLayer: React.FC<AssemblyLayerProps> = ({ 
  gameState, 
  runCode, 
  runUnitTests,
  onCodeChange,
  onOutputSet 
}) => {
  const { assemblyCode, assemblyOutput } = gameState.layerSpecificStates;
  // Use current maxMemory from gameState.resources
  const actualMaxMemory = gameState.resources.maxMemory;
  const codeCost = assemblyCode.length * CODE_COST_ASSEMBLY_PER_CHAR;
  const canExecute = codeCost <= actualMaxMemory;

  const unitTestCost = 5;

  const handleRunCode = useCallback(() => {
    if (!canExecute) {
      onOutputSet(`ERROR: Memory capacity (${actualMaxMemory.toFixed(0)} CU) exceeded. Required: ${codeCost.toFixed(1)} CU.`);
      return;
    }
    
    const result = runCode(assemblyCode, 'assembly'); 
    
    if (result.success) {
      onOutputSet(`SUCCESS: Execution generated ${result.ticksGenerated} Ticks.\n\n// Simulated execution log:\nLoading micro-ops...\nExecuting from address 0x0000...\nProgram terminated normally.`);
    } else {
      onOutputSet(`ERROR: Code execution failed due to runtime error or inefficiency.\nGenerated only ${result.ticksGenerated} Ticks.\n\n// Debug trace (simulated):\nSegmentation fault at 0x${Math.floor(Math.random() * 0xFFFF).toString(16).padStart(4, '0')}.`);
    }
  }, [assemblyCode, runCode, actualMaxMemory, codeCost, onOutputSet, canExecute]);

  const handleRunTests = useCallback(() => {
    if (gameState.resources.ticks < unitTestCost) {
      onOutputSet(`// Not enough Ticks to run unit tests. Cost: ${unitTestCost} Ticks.\nCheck global notifications for error details.`);
    } else {
      onOutputSet(`// Unit test suite initiated for Assembly Layer...\nCheck global notifications for results.`);
    }
    runUnitTests('assembly');
  }, [runUnitTests, onOutputSet, gameState.resources.ticks, unitTestCost]);
  
  return (
    <div className="animate-fadeIn">
      <h3 className="text-xl font-semibold mb-4 text-accent-primary">Assembly Programming Environment</h3>
      
      <div className="bg-gray-900 p-4 rounded border border-border-secondary shadow-md mb-4">
        <p className="mb-4 text-text-secondary text-sm">
          Craft low-level assembly routines using a simplified instruction set. Efficient assembly can yield substantial tick gains,
          but complexity (code length) increases error risk, entropy, and memory usage.
        </p>
        
        <div className="flex flex-col md:flex-row gap-4">
          {/* Code Editor Section */}
          <div className="md:w-1/2 flex flex-col">
            <div className="mb-2 flex justify-between items-center">
              <label htmlFor="asm-code-editor" className="font-medium text-text-primary">Assembly Code:</label>
              <span 
                className={`text-xs font-mono ${!canExecute ? "text-error-primary" : "text-text-secondary"}`}
                title={`Memory: ${codeCost.toFixed(1)} CU used / ${actualMaxMemory.toFixed(0)} CU max`}
              >
                {codeCost.toFixed(1)} / {actualMaxMemory.toFixed(0)} CU
              </span>
            </div>
            <textarea
              id="asm-code-editor"
              value={assemblyCode}
              onChange={(e) => onCodeChange(e.target.value)}
              className="flex-grow w-full h-64 md:h-auto bg-gray-800 text-gray-100 p-2 rounded border border-border-primary font-mono text-sm focus:ring-1 focus:ring-accent-primary focus:border-accent-primary resize-none"
              spellCheck="false"
              aria-label="Assembly Code Editor"
            />
          </div>
          
          {/* Output Section */}
          <div className="md:w-1/2 flex flex-col">
            <label htmlFor="asm-output-display" className="block mb-2 font-medium text-text-primary">Output & Logs:</label>
            <div
              id="asm-output-display"
              className="flex-grow w-full h-64 md:h-auto bg-gray-800 text-gray-100 p-2 rounded border border-border-primary font-mono text-sm overflow-auto whitespace-pre-wrap"
              aria-live="polite"
            >
              {assemblyOutput}
            </div>
          </div>
        </div>
        
        <div className="mt-4 flex flex-col sm:flex-row justify-end gap-3">
          <button
            onClick={handleRunTests}
            className="px-4 py-2 rounded font-semibold bg-yellow-500 hover:bg-yellow-600 text-black transition-colors duration-150 text-sm"
            title={`Cost: ${unitTestCost} Ticks. Runs a suite of tests to potentially find issues or grant a temporary buff.`}
          >
            Run Unit Tests (Cost: {unitTestCost} Ticks)
          </button>
          <button
            onClick={handleRunCode}
            disabled={!canExecute}
            className="px-4 py-2 rounded font-semibold bg-accent-primary hover:bg-green-600 text-black disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 text-sm"
            title={!canExecute ? `Memory limit exceeded (${codeCost.toFixed(1)}/${actualMaxMemory.toFixed(0)} CU)` : "Execute the current assembly code"}
          >
            Execute Assembly
          </button>
        </div>
      </div>
      
      <div className="bg-gray-900 p-4 rounded border border-border-secondary shadow-md">
        <h4 className="font-semibold mb-2 text-text-primary">Assembly Reference (Simplified ISA)</h4>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm text-text-secondary list-none p-0">
          <li><span className="font-mono text-text-primary">MOV reg, val</span> - Move value to register</li>
          <li><span className="font-mono text-text-primary">ADD reg, val</span> - Add value to register</li>
          <li><span className="font-mono text-text-primary">SUB reg, val</span> - Subtract value from register</li>
          <li><span className="font-mono text-text-primary">JMP lbl</span> - Jump to label (conceptual)</li>
          <li><span className="font-mono text-text-primary">NOP</span> - No operation (useful for padding or timing)</li>
          <li><span className="font-mono text-text-primary">RET</span> - Return from subroutine (ends execution here)</li>
          <li><span className="font-mono text-text-primary">; comment</span> - Line comments</li>
        </ul>
         <p className="text-xs text-text-secondary mt-3">Note: Registers (e.g., AX, BX) and labels are conceptual and abstracted by the simulation.</p>
      </div>
    </div>
  );
};

export default AssemblyLayer;