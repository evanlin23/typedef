import Game from './components/Game'

function App() {
  return (
    // Base styling moved to index.html body and tailwind.config.js
    // App component can focus on layout
    <div className="min-h-screen flex flex-col items-center p-4 sm:p-8">
      <div className="container w-full max-w-7xl mx-auto">
        <header className="flex flex-col sm:flex-row justify-between items-center mb-6 sm:mb-8 pb-4 border-b border-border-primary">
          <h1 className="text-3xl sm:text-4xl font-bold text-accent-primary mb-2 sm:mb-0">
            Synthesis
          </h1>
          <p className="text-sm text-text-secondary">A Programming Incremental Game</p>
        </header>
        
        <Game />
        
        <footer className="mt-8 pt-4 border-t border-border-primary text-center text-text-secondary text-xs">
          <p>Synthesis v0.2.0 - © {new Date().getFullYear()}</p>
        </footer>
      </div>
    </div>
  )
}

export default App