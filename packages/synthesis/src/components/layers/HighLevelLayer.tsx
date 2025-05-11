// src/components/layers/HighLevelLayer.tsx
import { useState } from 'react';

interface HighLevelLayerProps {
  runCode: (code: string) => { success: boolean; ticksGenerated: number };
  maxMemory: number;
}

const HighLevelLayer = ({ runCode, maxMemory }: HighLevelLayerProps) => {
  const [code, setCode] = useState(`// Write your high-level code here
function generateTicks() {
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += i;
  }
  return sum;
}

generateTicks();`);
  
  const [output, setOutput] = useState('// Output will appear here');
  
  const handleRunCode = () => {
    // Check if code exceeds memory
    if (code.length > maxMemory * 20) {
      setOutput('ERROR: Memory capacity exceeded');
      return;
    }
    
    const result = runCode(code);
    
    if (result.success) {
      setOutput(`SUCCESS: Generated ${result.ticksGenerated} ticks\n\n// Execution result:
Running code...
Function called: generateTicks()
Loop iterations: 10
Return value: 45
Program executed successfully.`);
    } else {
      setOutput(`ERROR: Code execution failed\nGenerated only ${result.ticksGenerated} ticks\n\n// Debug info:
Error at line ${Math.floor(Math.random() * code.split('\n').length) + 1}
${Math.random() > 0.5 ? 'TypeError: Cannot read property of undefined' : 'SyntaxError: Unexpected token'}
Execution halted`);
    }
  };
  
  return (
    <div>
      <h3 className="text-xl mb-4 text-green-400">High-Level Language Layer</h3>
      
      <div className="bg-gray-900 p-4 rounded border border-gray-700 mb-4">
        <p className="mb-4">
          The High-Level Language Layer allows you to write code in modern programming languages to generate ticks more efficiently.
          High-level code can generate significantly more ticks when successful.
        </p>
        
        <div className="flex flex-col md:flex-row gap-4">
          <div className="md:w-1/2">
            <div className="mb-2 flex justify-between">
              <label htmlFor="high-code" className="font-medium">Code:</label>
              <span className={code.length > maxMemory * 20 ? "text-red-600" : ""}>
                {code.length} / {maxMemory * 20} bytes
              </span>
            </div>
            <textarea
              id="high-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full h-64 bg-gray-900 text-gray-200 p-2 rounded border border-gray-700 font-mono text-sm"
            />
          </div>
          
          <div className="md:w-1/2">
            <div className="mb-2">
              <label htmlFor="high-output" className="font-medium">Output:</label>
            </div>
            <div
              id="high-output"
              className="w-full h-64 bg-gray-900 text-gray-200 p-2 rounded border border-gray-700 font-mono text-sm overflow-auto whitespace-pre-wrap"
            >
              {output}
            </div>
          </div>
        </div>
        
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleRunCode}
            className="bg-green-400 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            Run Code
          </button>
        </div>
      </div>
      
      <div className="bg-gray-900 p-4 rounded border border-gray-700">
        <h4 className="font-semibold mb-2">Language Features</h4>
        <div className="space-y-2">
          <p>
            <span className="font-semibold">JavaScript:</span> Higher tick generation for well-structured functions, loops, and efficient algorithms.
          </p>
          <p>
            <span className="font-semibold">Python:</span> Better at data processing and string manipulation, generates more ticks for data-focused code.
          </p>
          <p>
            <span className="font-semibold">C:</span> Most efficient for optimization and raw performance, but higher chance of memory errors.
          </p>
        </div>
      </div>
    </div>
  );
};

export default HighLevelLayer;