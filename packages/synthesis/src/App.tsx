import { useState, useEffect } from 'react'
import Game from './components/Game'

function App() {
  return (
    <div className="min-h-screen bg-gray-100 text-gray-900">
      <div className="container mx-auto px-4 py-8">
        <header className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-green-600">
            Synthesis
          </h1>
        </header>
        
        <Game />
        
        <footer className="mt-8 text-center text-gray-500 text-sm">
          <p>Synthesis v0.1.0 - A Programming Incremental Game</p>
        </footer>
      </div>
    </div>
  )
}

export default App