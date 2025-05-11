export default function Footer() {
  return (
    <footer className="bg-gray-800 py-4 mt-8">
      <div className="container mx-auto px-4 text-center">
        <div className="flex justify-center">
          <a 
            href="https://github.com/evanlin23/typedef" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-purple-400 hover:underline mx-2 transition duration-150"
          >
            GitHub
          </a>
        </div>
      </div>
    </footer>
  )
}