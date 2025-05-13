import { Outlet, Link } from 'react-router-dom'

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-800 text-gray-200">
      <header className="bg-gray-900 text-gray-200 p-4 shadow-md">
        <div className="container mx-auto flex justify-between items-center">
          <Link to="/" className="text-xl font-bold text-orange-400">ioctl</Link>
        </div>
      </header>
      
      <main className="flex-grow container mx-auto px-4 py-6">
        <Outlet />
      </main>
      
      <footer className="bg-gray-900 text-gray-300 p-4 mt-auto">
        <div className="flex justify-center">
          <a 
            href="https://github.com/evanlin23/typedef" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-purple-400 hover:underline mx-2"
          >
            GitHub
          </a>
        </div>
      </footer>
    </div>
  )
}