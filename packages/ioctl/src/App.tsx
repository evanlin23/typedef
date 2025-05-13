import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import FolderFlattener from './pages/FolderFlattener'
import NotFound from './pages/NotFound'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="folder-flattener" element={<FolderFlattener />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}

export default App