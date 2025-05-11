// src/components/layers/HighLevelLayer.tsx
import React, { useCallback } from 'react'; // Removed useState
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

  const handleRunCode = useCallback(() => {
    if (codeCost > actualMaxMemory) {
      onOutputSet(`ERROR: Memory capacity exceeded. Required: ${codeCost.toFixed(1)} CU, Available: ${actualMaxMemory.toFixed(0)} CU`);
      return;
    }
    
    const result = runCode(highLevelCode, 'highLevel');
    
    if (result.success) {
      onOutputSet(`SUCCESS: Generated ${result.ticksGenerated} ticks.\n\n// Simulated execution:\nCompiling...\nExecuting...\nProgram completed.`);
    } else {
      onOutputSet(`ERROR: Code execution failed.\nGenerated only ${result.ticksGenerated} ticks.\n\n// Debug info:\nError at line ${Math.floor(Math.random() * highLevelCode.split('\n').length) + 1}.`);
    }
  }, [highLevelCode, runCode, actualMaxMemory, codeCost, onOutputSet]);

  const handleRunTests = useCallback(() => {
    runUnitTests('highLevel');
    onOutputSet(`// Unit test suite initiated for High-Level Language Layer...\nCheck global notifications for results.`);
  }, [runUnitTests, onOutputSet]);

  return (
    <div className="animate-fadeIn">
      <h3 className="text-xl mb-4 text-accent-primary">High-Level Language Layer</h3>
      <div className="bg-background-secondary p-4 rounded border border-border-primary shadow-md mb-4">
        <p className="mb-4 text-text-secondary">
          Utilize pseudo high-level languages for more abstract and powerful code. 
          Achieve greater tick generation, but beware of higher-level bugs and memory footprint.
        </p>
        
        <div className="flex flex-col md:flex-row gap-4">
          <div className="md:w-1/2">
            <div className="mb-2 flex justify-between items-center">
              <label htmlFor="hll-code" className="font-medium text-text-primary">High-Level Code:</label>
              <span className={`text-xs ${codeCost > actualMaxMemory ? "text-error-primary" : "text-text-secondary"}`}>
                {codeCost.toFixed(1)} / {actualMaxMemory.toFixed(0)} CU
              </span>
            </div>
            <textarea
              id="hll-code"
              value={highLevelCode}
              onChange={(e) => onCodeChange(e.target.value)}
              className="w-full h-64 bg-gray-900 text-gray-100 p-2 rounded border border-border-secondary font-mono text-sm focus:ring-1 focus:ring-accent-primary focus:border-accent-primary"
              spellCheck="false"
            />
          </div>
          <div className="md:w-1/2">
            <label htmlFor="hll-output" className="block mb-2 font-medium text-text-primary">Output:</label>
            <div
              id="hll-output"
              className="w-full h-64 bg-gray-900 text-gray-100 p-2 rounded border border-border-secondary font-mono text-sm overflow-auto whitespace-pre-wrap"
            >
              {highLevelOutput}
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-col sm:flex-row justify-end gap-2">
           <button
            onClick={handleRunTests}
            className="px-4 py-2 rounded font-semibold bg-yellow-500 hover:bg-yellow-600 text-black transition-colors duration-150 text-sm"
          >
            Run Unit Tests (Cost: 15 Ticks)
          </button>
          <button
            onClick={handleRunCode}
            disabled={codeCost > actualMaxMemory}
            className="px-4 py-2 rounded font-semibold bg-accent-primary hover:bg-green-600 text-black disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 text-sm"
          >
            Compile & Run
          </button>
        </div>
      </div>
      <div className="bg-background-secondary p-4 rounded border border-border-primary shadow-md">
        <h4 className="font-semibold mb-2 text-text-primary">Language Abstractions (Conceptual)</h4>
        <div className="space-y-1 text-sm text-text-secondary">
          <p><span className="font-semibold text-text-primary">Algorithm Efficiency:</span> Complex loops, data structures, and recursion can yield higher ticks.</p>
          <p><span className="font-semibold text-text-primary">Modularity:</span> Well-defined functions are easier to "test".</p>
          <p><span className="font-semibold text-text-primary">Error Handling:</span> "Bugs" in complex code contribute to entropy.</p>
        </div>
      </div>
    </div>
  );
};

export default HighLevelLayer;