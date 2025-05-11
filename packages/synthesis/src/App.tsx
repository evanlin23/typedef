import { useState } from 'react'
import './App.css'
import Game from './components/Game'

function App() {
  const [darkMode, setDarkMode] = useState(true)

  const toggleTheme = () => {
    setDarkMode(prev => !prev)
  }

  return (
    <div className={`min-h-screen ${darkMode ? 'dark' : 'light'}`}>
      <div className="container mx-auto px-4 py-8">
        <header className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-[color:var(--color-accent-primary)]">
            Synthesis
          </h1>
          <button 
            onClick={toggleTheme}
            className="p-2 rounded bg-[color:var(--color-bg-secondary)] border border-[color:var(--color-border-primary)]"
          >
            {darkMode ? '☀️' : '🌙'}
          </button>
        </header>
        
        <Game />
        
        <footer className="mt-8 text-center text-[color:var(--color-text-secondary)] text-sm">
          <p>Synthesis v0.1.0 - A Programming Incremental Game</p>
        </footer>
      </div>
    </div>
  )
}

export default App