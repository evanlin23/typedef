import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="text-center py-10">
      <h1 className="text-6xl font-bold text-orange-400 mb-4">404</h1>
      <h2 className="text-2xl font-semibold mb-4 text-gray-200">Page Not Found</h2>
      <p className="text-gray-300 mb-6">
        The page you are looking for doesn't exist or has been moved.
      </p>
      <Link to="/" className="bg-orange-500 hover:bg-orange-600 text-gray-100 font-medium py-2 px-4 rounded transition-colors">
        Go Home
      </Link>
    </div>
  )
}