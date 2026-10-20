export default function PresentationPdfHelp() {
  return (
    <details className="mb-4 rounded border border-gray-500 p-3 text-gray-300">
      <summary className="cursor-pointer font-medium text-orange-300">Combining PowerPoint slides? Export a PDF first</summary>
      <div className="mt-3 space-y-3 text-sm">
        <p>Export your presentation as a PDF, then add that PDF here to combine it.</p>
        <p><strong>PowerPoint:</strong> Open the presentation and choose File → Export or Save As → PDF. Use PowerPoint for the closest match to a PowerPoint presentation.</p>
        <p><strong>Google Slides (free with a Google account):</strong> Open your presentation in{' '}
          <a href="https://slides.google.com/" target="_blank" rel="noopener noreferrer" className="text-purple-300 underline">Google Slides</a>, then choose File → Download → PDF Document (.pdf).
          {' '}This requires uploading the presentation to Google.</p>
        <p>Check the exported PDF before combining it. Google Slides can change fonts and layouts; no export method guarantees every presentation will look identical.</p>
      </div>
    </details>
  );
}
