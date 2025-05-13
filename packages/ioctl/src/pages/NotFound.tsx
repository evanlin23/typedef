import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="text-center py-10">
      <h1 className="text-6xl font-bold text-slate-800 dark:text-slate-200 mb-4">404</h1>
      <h2 className="text-2xl font-semibold mb-4">Page Not Found</h2>
      <p className="text-slate-600 dark:text-slate-400 mb-6">
        The page you are looking for doesn't exist or has been moved.
      </p>
      <Link to="/" className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition-colors">
        Go Home
      </Link>
    </div>
  )
}