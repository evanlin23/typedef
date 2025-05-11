// src/components/layers/AssemblyLayer.tsx
import React, { useCallback } from 'react'; // Removed useState
import { type GameState, CODE_COST_ASSEMBLY_PER_CHAR, calculateActualMaxMemory } from '../../types/gameState';

interface AssemblyLayerProps {
  gameState: GameState;
  runCode: (code: string, layer: string) => { success: boolean; ticksGenerated: number };
  runUnitTests: (layer: string) => void;
  onCodeChange: (newCode: string) => void;    // New prop
  onOutputSet: (newOutput: string) => void;   // New prop for setting output directly
}

const AssemblyLayer: React.FC<AssemblyLayerProps> = ({ 
  gameState, 
  runCode, 
  runUnitTests,
  onCodeChange,
  onOutputSet 
}) => {
  const { assemblyCode, assemblyOutput } = gameState.layerSpecificStates;
  const actualMaxMemory = calculateActualMaxMemory(gameState);
  const codeCost = assemblyCode.length * CODE_COST_ASSEMBLY_PER_CHAR;

  const handleRunCode = useCallback(() => {
    if (codeCost > actualMaxMemory) {
      onOutputSet(`ERROR: Memory capacity exceeded. Required: ${codeCost.toFixed(1)} CU, Available: ${actualMaxMemory.toFixed(0)} CU`);
      return;
    }
    
    // runCode now gets its code from gameState, so assemblyCode arg here is for consistency / could be removed from runCode signature for this layer
    const result = runCode(assemblyCode, 'assembly'); 
    
    if (result.success) {
      onOutputSet(`SUCCESS: Generated ${result.ticksGenerated} ticks.\n\n// Simulated execution:\nExecuting assembly program...\nProgram completed.`);
    } else {
      onOutputSet(`ERROR: Code execution failed.\nGenerated only ${result.ticksGenerated} ticks.\n\n// Debug info:\nError at segment ${Math.floor(Math.random() * 1000)}.`);
    }
  }, [assemblyCode, runCode, actualMaxMemory, codeCost, onOutputSet]);

  const handleRunTests = useCallback(() => {
    runUnitTests('assembly'); // This function in Game.tsx might use addToast or set a global notification
    // We can still update local-like output if desired, or rely on global toasts
    onOutputSet(`// Unit test suite initiated for Assembly Layer...\nCheck global notifications for results.`);
  }, [runUnitTests, onOutputSet]);
  
  return (
    <div className="animate-fadeIn">
      <h3 className="text-xl mb-4 text-accent-primary">Assembly Layer</h3>
      
      <div className="bg-background-secondary p-4 rounded border border-border-primary shadow-md mb-4">
        <p className="mb-4 text-text-secondary">
          Craft low-level assembly routines. Efficient assembly can yield substantial tick gains,
          but complexity increases error risk and entropy.
        </p>
        
        <div className="flex flex-col md:flex-row gap-4">
          <div className="md:w-1/2">
            <div className="mb-2 flex justify-between items-center">
              <label htmlFor="asm-code" className="font-medium text-text-primary">Assembly Code:</label>
              <span className={`text-xs ${codeCost > actualMaxMemory ? "text-error-primary" : "text-text-secondary"}`}>
                {codeCost.toFixed(1)} / {actualMaxMemory.toFixed(0)} CU
              </span>
            </div>
            <textarea
              id="asm-code"
              value={assemblyCode}
              onChange={(e) => onCodeChange(e.target.value)}
              className="w-full h-64 bg-gray-900 text-gray-100 p-2 rounded border border-border-secondary font-mono text-sm focus:ring-1 focus:ring-accent-primary focus:border-accent-primary"
              spellCheck="false"
            />
          </div>
          
          <div className="md:w-1/2">
            <label htmlFor="asm-output" className="block mb-2 font-medium text-text-primary">Output:</label>
            <div
              id="asm-output"
              className="w-full h-64 bg-gray-900 text-gray-100 p-2 rounded border border-border-secondary font-mono text-sm overflow-auto whitespace-pre-wrap"
            >
              {assemblyOutput}
            </div>
          </div>
        </div>
        
        <div className="mt-4 flex flex-col sm:flex-row justify-end gap-2">
          <button
            onClick={handleRunTests}
            className="px-4 py-2 rounded font-semibold bg-yellow-500 hover:bg-yellow-600 text-black transition-colors duration-150 text-sm"
          >
            Run Unit Tests (Cost: 5 Ticks)
          </button>
          <button
            onClick={handleRunCode}
            disabled={codeCost > actualMaxMemory}
            className="px-4 py-2 rounded font-semibold bg-accent-primary hover:bg-green-600 text-black disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 text-sm"
          >
            Execute Assembly
          </button>
        </div>
      </div>
      
      <div className="bg-background-secondary p-4 rounded border border-border-primary shadow-md">
        <h4 className="font-semibold mb-2 text-text-primary">Assembly Reference (Simplified)</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm text-text-secondary">
          <div><span className="font-mono text-text-primary">MOV reg, val</span> - Move value</div>
          <div><span className="font-mono text-text-primary">ADD reg, val</span> - Add value</div>
          <div><span className="font-mono text-text-primary">SUB reg, val</span> - Subtract value</div>
          <div><span className="font-mono text-text-primary">JMP lbl</span> - Jump to label</div>
          <div><span className="font-mono text-text-primary">LOOP reg, lbl</span> - Loop (dec reg)</div>
          <div><span className="font-mono text-text-primary">NOP</span> - No operation</div>
          <div><span className="font-mono text-text-primary">RET</span> - Return</div>
        </div>
      </div>
    </div>
  );
};

export default AssemblyLayer;