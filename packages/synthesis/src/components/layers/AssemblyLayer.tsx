// src/components/layers/AssemblyLayer.tsx
import { useState } from 'react';

interface AssemblyLayerProps {
  runCode: (code: string) => { success: boolean; ticksGenerated: number };
  maxMemory: number;
}

const AssemblyLayer = ({ runCode, maxMemory }: AssemblyLayerProps) => {
  const [code, setCode] = useState(`; Write your assembly code here
MOV AX, 1
MOV BX, 2
ADD AX, BX
RET`);
  
  const [output, setOutput] = useState('// Output will appear here');
  
  const handleRunCode = () => {
    // Check if code exceeds memory
    if (code.length > maxMemory * 10) {
      setOutput('ERROR: Memory capacity exceeded');
      return;
    }
    
    const result = runCode(code);
    
    if (result.success) {
      setOutput(`SUCCESS: Generated ${result.ticksGenerated} ticks\n\n// Simulated execution:
Running code...
AX = 1
BX = 2
AX = 3
Program returned successfully.`);
    } else {
      setOutput(`ERROR: Code execution failed\nGenerated only ${result.ticksGenerated} ticks\n\n// Debug info:
Error at line ${Math.floor(Math.random() * code.split('\n').length) + 1}
Potential stack corruption
Memory access violation`);
    }
  };
  
  return (
    <div>
      <h3 className="text-xl mb-4 text-green-600">Assembly Layer</h3>
      
      <div className="bg-gray-100 p-4 rounded border border-gray-300 mb-4">
        <p className="mb-4">
          The Assembly Layer allows you to write low-level assembly code to generate ticks more efficiently.
          More complex code can generate more ticks, but also carries higher risk of failure.
        </p>
        
        <div className="flex flex-col md:flex-row gap-4">
          <div className="md:w-1/2">
            <div className="mb-2 flex justify-between">
              <label htmlFor="code" className="font-medium">Assembly Code:</label>
              <span className={code.length > maxMemory * 10 ? "text-red-600" : ""}>
                {code.length} / {maxMemory * 10} bytes
              </span>
            </div>
            <textarea
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full h-64 bg-gray-200 text-gray-900 p-2 rounded border border-gray-300 font-mono text-sm"
            />
          </div>
          
          <div className="md:w-1/2">
            <div className="mb-2">
              <label htmlFor="output" className="font-medium">Output:</label>
            </div>
            <div
              id="output"
              className="w-full h-64 bg-gray-200 text-gray-900 p-2 rounded border border-gray-300 font-mono text-sm overflow-auto whitespace-pre-wrap"
            >
              {output}
            </div>
          </div>
        </div>
        
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleRunCode}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            Run Code
          </button>
        </div>
      </div>
      
      <div className="bg-gray-100 p-4 rounded border border-gray-300">
        <h4 className="font-semibold mb-2">Assembly Reference</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
          <div>
            <span className="font-mono">MOV reg, value</span> - Move value to register
          </div>
          <div>
            <span className="font-mono">ADD reg, value</span> - Add value to register
          </div>
          <div>
            <span className="font-mono">SUB reg, value</span> - Subtract value from register
          </div>
          <div>
            <span className="font-mono">JMP label</span> - Jump to label
          </div>
          <div>
            <span className="font-mono">LOOP reg, label</span> - Loop to label reg times
          </div>
          <div>
            <span className="font-mono">RET</span> - Return from procedure
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssemblyLayer;