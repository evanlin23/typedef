import Game from './components/Game';

function App() {
  return (
    <div className="min-h-screen flex flex-col items-center p-4 sm:p-8">
      <div className="container w-full max-w-7xl mx-auto flex flex-col flex-grow"> {/* flex-grow for footer */}
        <header className="flex flex-col sm:flex-row justify-between items-center mb-6 sm:mb-8 pb-4 border-b border-border-primary">
          <h1 className="text-3xl sm:text-4xl font-bold text-accent-primary mb-2 sm:mb-0">
            Synthesis
          </h1>
          <p className="text-sm text-text-secondary">A Programming Incremental Game</p>
        </header>
        
        <main className="flex-grow"> {/* main content takes available space */}
          <Game />
        </main>
        
        <footer className="p-4 mt-8 text-center text-text-secondary text-sm border-t border-border-primary"> {/* mt-8 for spacing */}
          <p>
            Created by [Your Name/Alias Here if you wish, or remove this line]. Game version from provided code.
          </p>
          <div className="flex justify-center mt-2">
            <a 
              href="https://github.com/evanlin23/typedef" 
              target="_blank" 
              rel="noopener noreferrer" // Important for security
              className="text-purple-400 hover:underline mx-2"
            >
              GitHub
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default App;