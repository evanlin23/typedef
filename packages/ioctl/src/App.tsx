// src/App.tsx
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import FolderFlattener from './pages/FolderFlattener'
import PdfCombiner from './pages/PDFCombiner'
import ImageAnimatorPage from './pages/animation/ImageAnimatorPage'
import MultiImageAnimatorPage from './pages/animation/MultiImageAnimatorPage'

import NotFound from './pages/NotFound'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="folder-flattener" element={<FolderFlattener />} />
        <Route path="pdf-combiner" element={<PdfCombiner />} />
        <Route path="image-animator" element={<ImageAnimatorPage />} />
        <Route path="multi-animator" element={<MultiImageAnimatorPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}

export default App