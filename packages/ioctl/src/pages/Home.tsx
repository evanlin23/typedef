// src/pages/Home.tsx
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
        <UtilCard
          title="Image Animator"
          description="Upload an image, select two points, and generate a 9:16 MP4 video with a zoom-pan-zoom animation."
          linkTo="/image-animator"
          linkText="Open Image Animator"
        />
        <UtilCard
          title="Multi Image Animator"
          description="Upload multiple image, select two points in each, and generate a 9:16 MP4 video with a zoom-pan-zoom animation for each image with transitions in between"
          linkTo="/multi-animator"
          linkText="Open Multi Image Animator"
        />
      </div>
    </div>
  )
}