import UtilCard from '../components/UtilCard'

export default function Home() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <UtilCard
          title="Folder Flattener"
          description="Flattens a folder structure by converting nested TS/TSX files into a zip with flattened filenames and path comments."
          linkTo="/folder-flattener"
          linkText="Open Folder Flattener"
        />
        <UtilCard
          title="PDF Combiner"
          description="Upload multiple PDF files, reorder them, and combine them into a single document."
          linkTo="/pdf-combiner"
          linkText="Open PDF Combiner"
        />
      </div>
    </div>
  )
}