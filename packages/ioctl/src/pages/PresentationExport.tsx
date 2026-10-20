import { Link } from 'react-router-dom';
import PresentationPdfHelp from '../components/PresentationPdfHelp';

export default function PresentationExport() {
  return (
    <div className="max-w-4xl mx-auto p-6 bg-gray-700 shadow-lg rounded-lg text-gray-200">
      <h2 className="text-2xl font-bold text-orange-400 mb-2">Export your presentation as PDF</h2>
      <p className="text-gray-300 mb-4">The experimental PPTX converter has been retired because it could change slide layouts, fonts, and equations. Export a PDF in PowerPoint or Google Slides, then combine your PDFs here.</p>
      <PresentationPdfHelp />
      <Link to="/pdf-combiner" className="text-purple-300 underline">Open PDF Combiner</Link>
    </div>
  );
}
