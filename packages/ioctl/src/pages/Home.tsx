import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-center">ioctl Utilities</h1>
      
      <p className="mb-8 text-slate-600 dark:text-slate-400 text-center">
        A collection of random utilities for everyday use
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-md border border-slate-200 dark:border-slate-700">
          <h2 className="text-xl font-semibold mb-3">Folder Flattener</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            Flattens a folder structure by converting nested TS/TSX files into a 
            zip with flattened filenames and path comments.
          </p>
          <Link 
            to="/folder-flattener" 
            className="block w-full bg-blue-600 hover:bg-blue-700 text-white text-center py-2 rounded transition-colors"
          >
            Open Folder Flattener
          </Link>
        </div>
        
        {/* You can add more utility cards here as you develop them */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-md border border-slate-200 dark:border-slate-700 opacity-50">
          <h2 className="text-xl font-semibold mb-3">Coming Soon...</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            More utilities are currently in development.
          </p>
          <button 
            disabled
            className="block w-full bg-slate-500 text-white text-center py-2 rounded cursor-not-allowed"
          >
            Not Available
          </button>
        </div>
      </div>
    </div>
  )
}