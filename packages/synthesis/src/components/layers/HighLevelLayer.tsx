// src/components/layers/HighLevelLayer.tsx
import React, { useCallback } from 'react';
import { type GameState, CODE_COST_HIGHLEVEL_PER_CHAR, calculateActualMaxMemory } from '../../types/gameState';

interface HighLevelLayerProps {
  gameState: GameState;
  runCode: (code: string, layer: string) => { success: boolean; ticksGenerated: number };
  runUnitTests: (layer: string) => void;
  onCodeChange: (newCode: string) => void;
  onOutputSet: (newOutput: string) => void;
}

const HighLevelLayer: React.FC<HighLevelLayerProps> = ({ 
  gameState, 
  runCode, 
  runUnitTests,
  onCodeChange,
  onOutputSet
}) => {
  const { highLevelCode, highLevelOutput } = gameState.layerSpecificStates;
  const actualMaxMemory = calculateActualMaxMemory(gameState);
  const codeCost = highLevelCode.length * CODE_COST_HIGHLEVEL_PER_CHAR;
  const canExecute = codeCost <= actualMaxMemory;

  const unitTestCost = 15; // Defined here for clarity and display

  const handleRunCode = useCallback(() => {
    if (!canExecute) {
      onOutputSet(`ERROR: Memory capacity (${actualMaxMemory.toFixed(0)} CU) exceeded. Required: ${codeCost.toFixed(1)} CU.`);
      return;
    }
    
    // runCode in Game.tsx will use gameState.layerSpecificStates.highLevelCode
    const result = runCode(highLevelCode, 'highLevel');
    
    if (result.success) {
      onOutputSet(`SUCCESS: Compilation and execution generated ${result.ticksGenerated} Ticks.\n\n// Simulated execution log:\nSource code analyzed...\nBytecode compilation complete...\nVirtual machine executing...\nProgram finished successfully.`);
    } else {
      const errorLine = Math.floor(Math.random() * highLevelCode.split('\n').length) + 1;
      onOutputSet(`ERROR: Code execution failed due to runtime exception or logical error.\nGenerated only ${result.ticksGenerated} Ticks.\n\n// Debug trace (simulated):\nException: NullReferenceError on line ${errorLine}.\nStack trace available (simulated).`);
    }
  }, [highLevelCode, runCode, actualMaxMemory, codeCost, onOutputSet, canExecute]);

  const handleRunTests = useCallback(() => {
     if (gameState.resources.ticks < unitTestCost) {
      onOutputSet(`// Not enough Ticks to run unit tests. Cost: ${unitTestCost} Ticks.\nCheck global notifications for error details.`);
    } else {
      onOutputSet(`// Unit test suite initiated for High-Level Language Layer...\nCheck global notifications for results.`);
    }
    runUnitTests('highLevel');
  }, [runUnitTests, onOutputSet, gameState.resources.ticks, unitTestCost]);

  return (
    <div className="animate-fadeIn">
      <h3 className="text-xl font-semibold mb-4 text-accent-primary">High-Level Language Environment</h3>
      <div className="bg-gray-900 p-4 rounded border border-border-secondary shadow-md mb-4">
        <p className="mb-4 text-text-secondary text-sm">
          Utilize a pseudo high-level language (JavaScript-like syntax) for more abstract and powerful algorithms.
          Achieve greater tick generation through complex logic, but beware of higher-level bugs, increased entropy from failures, and larger memory footprints.
        </p>
        
        <div className="flex flex-col md:flex-row gap-4">
          {/* Code Editor Section */}
          <div className="md:w-1/2 flex flex-col">
            <div className="mb-2 flex justify-between items-center">
              <label htmlFor="hll-code-editor" className="font-medium text-text-primary">High-Level Code:</label>
              <span 
                className={`text-xs font-mono ${!canExecute ? "text-error-primary" : "text-text-secondary"}`}
                title={`Memory: ${codeCost.toFixed(1)} CU used / ${actualMaxMemory.toFixed(0)} CU max`}
              >
                {codeCost.toFixed(1)} / {actualMaxMemory.toFixed(0)} CU
              </span>
            </div>
            <textarea
              id="hll-code-editor"
              value={highLevelCode}
              onChange={(e) => onCodeChange(e.target.value)}
              className="flex-grow w-full h-64 md:h-auto bg-gray-800 text-gray-100 p-2 rounded border border-border-primary font-mono text-sm focus:ring-1 focus:ring-accent-primary focus:border-accent-primary resize-none"
              spellCheck="false"
              aria-label="High-Level Code Editor"
            />
          </div>

          {/* Output Section */}
          <div className="md:w-1/2 flex flex-col">
            <label htmlFor="hll-output-display" className="block mb-2 font-medium text-text-primary">Output & Logs:</label>
            <div
              id="hll-output-display"
              className="flex-grow w-full h-64 md:h-auto bg-gray-800 text-gray-100 p-2 rounded border border-border-primary font-mono text-sm overflow-auto whitespace-pre-wrap"
              aria-live="polite"
            >
              {highLevelOutput}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row justify-end gap-3">
           <button
            onClick={handleRunTests}
            className="px-4 py-2 rounded font-semibold bg-yellow-500 hover:bg-yellow-600 text-black transition-colors duration-150 text-sm"
            title={`Cost: ${unitTestCost} Ticks. Verifies code integrity and may grant a temporary buff.`}
          >
            Run Unit Tests (Cost: {unitTestCost} Ticks)
          </button>
          <button
            onClick={handleRunCode}
            disabled={!canExecute}
            className="px-4 py-2 rounded font-semibold bg-accent-primary hover:bg-green-600 text-black disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 text-sm"
            title={!canExecute ? `Memory limit exceeded (${codeCost.toFixed(1)}/${actualMaxMemory.toFixed(0)} CU)` : "Compile and run the high-level code"}
          >
            Compile & Run
          </button>
        </div>
      </div>
      <div className="bg-gray-900 p-4 rounded border border-border-secondary shadow-md">
        <h4 className="font-semibold mb-2 text-text-primary">Language Concepts & Abstractions</h4>
        <ul className="space-y-1 text-sm text-text-secondary list-disc list-inside pl-2">
          <li><span className="font-semibold text-text-primary">Algorithmic Complexity:</span> More sophisticated algorithms (e.g., complex loops, recursion, advanced math) generally yield higher Ticks but are harder to "get right".</li>
          <li><span className="font-semibold text-text-primary">Modularity & Functions:</span> Well-defined functions improve readability and are conceptually easier to "test" by the unit test system.</li>
          <li><span className="font-semibold text-text-primary">Error Propagation:</span> "Bugs" or inefficiencies in complex high-level code contribute more significantly to system entropy upon failure.</li>
          <li><span className="font-semibold text-text-primary">Memory Management:</span> While abstracted, larger codebases and complex data structures (simulated) consume more Code Units (CU).</li>
        </ul>
      </div>
    </div>
  );
};

export default HighLevelLayer;