// src/components/layers/AssemblyLayer.tsx
import React, { useCallback } from 'react';
import { useGameContext } from '../../contexts/GameContext';
import CodeEnvironmentUI from '../shared/CodeEnvironmentUI';
import { CODE_COST_ASSEMBLY_PER_CHAR } from '../../types/gameState';

const AssemblyLayer: React.FC = () => {
  const { 
    gameState, 
    runCode, 
    runUnitTests,
    handleAssemblyCodeChange, // ** Use from context **
    handleAssemblyOutputSet   // ** Use from context **
  } = useGameContext();

  const { assemblyCode, assemblyOutput } = gameState.layerSpecificStates;
  const actualMaxMemory = gameState.resources.maxMemory;
  const codeCost = assemblyCode.length * CODE_COST_ASSEMBLY_PER_CHAR;
  const canExecute = codeCost <= actualMaxMemory;
  const unitTestCost = 5;

  const handleRunCodeInternal = useCallback(() => {
    if (!canExecute) {
      handleAssemblyOutputSet(`ERROR: Memory capacity (${actualMaxMemory.toFixed(0)} CU) exceeded. Required: ${codeCost.toFixed(1)} CU.`);
      return;
    }
    // runCode from context now takes the code directly from gameState.layerSpecificStates.assemblyCode
    // so we don't need to pass assemblyCode as the first argument if CodeActions.runCode is adapted to read it.
    // For now, the runCode in context still expects codeFromLayer.
    const result = runCode(assemblyCode, 'assembly'); 
    
    if (result.success) {
      handleAssemblyOutputSet(`SUCCESS: Execution generated ${result.ticksGenerated} Ticks.\n\n// Simulated execution log:\nLoading micro-ops...\nExecuting from address 0x0000...\nProgram terminated normally.`);
    } else {
      handleAssemblyOutputSet(`ERROR: Code execution failed due to runtime error or inefficiency.\nGenerated only ${result.ticksGenerated} Ticks.\n\n// Debug trace (simulated):\nSegmentation fault at 0x${Math.floor(Math.random() * 0xFFFF).toString(16).padStart(4, '0')}.`);
    }
  }, [assemblyCode, runCode, actualMaxMemory, codeCost, handleAssemblyOutputSet, canExecute]);

  const handleRunTestsInternal = useCallback(() => {
    if (gameState.resources.ticks < unitTestCost) {
      handleAssemblyOutputSet(`// Not enough Ticks to run unit tests. Cost: ${unitTestCost} Ticks.\nCheck global notifications for error details.`);
    } else {
      handleAssemblyOutputSet(`// Unit test suite initiated for Assembly Layer...\nCheck global notifications for results.`);
    }
    runUnitTests('assembly');
  }, [runUnitTests, handleAssemblyOutputSet, gameState.resources.ticks, unitTestCost]);
  
  return (
    <div className="animate-fadeIn">
      <h3 className="text-xl font-semibold mb-4 text-accent-primary">Assembly Programming Environment</h3>
      
      <div className="bg-gray-900 p-4 rounded border border-border-secondary shadow-md mb-4">
        <p className="mb-4 text-text-secondary text-sm">
          Craft low-level assembly routines using a simplified instruction set. Efficient assembly can yield substantial tick gains,
          but complexity (code length) increases error risk, entropy, and memory usage.
        </p>
        
        {/* ** Use CodeEnvironmentUI ** */}
        <CodeEnvironmentUI
          layerKey="asm"
          code={assemblyCode}
          onCodeChange={handleAssemblyCodeChange}
          output={assemblyOutput}
          codeLabel="Assembly Code"
          outputLabel="Output & Logs"
          memoryCost={codeCost}
          maxMemory={actualMaxMemory}
          canExecute={canExecute}
        />
        
        <div className="mt-4 flex flex-col sm:flex-row justify-end gap-3">
          <button
            onClick={handleRunTestsInternal}
            className="px-4 py-2 rounded font-semibold bg-yellow-500 hover:bg-yellow-600 text-black transition-colors duration-150 text-sm"
            title={`Cost: ${unitTestCost} Ticks. Runs a suite of tests to potentially find issues or grant a temporary buff.`}
          >
            Run Unit Tests (Cost: {unitTestCost} Ticks)
          </button>
          <button
            onClick={handleRunCodeInternal}
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