import { useState, useCallback, useEffect, useRef, type DragEvent as ReactDragEvent, type ChangeEvent } from 'react';
import { PPTX_MIME, isPptx } from './pptx/fileTypes';
import PresentationFonts from './pptx/PresentationFonts';

interface Conversion {
  id: string;
  file: File;
  status: 'waiting' | 'converting' | 'done' | 'error';
  progress?: string;
  pdfUrl?: string;
  error?: string;
}

const pdfName = (file: File) => `${file.name.replace(/\.pptx$/i, '')}.pdf`;

function PptxConverter() {
  const [conversions, setConversions] = useState<Conversion[]>([]);
  const [isDraggingOverZone, setIsDraggingOverZone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fontFiles, setFontFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Files are converted one at a time; each conversion is chained onto this
  const queue = useRef(Promise.resolve());
  const pdfUrls = useRef<string[]>([]);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      pdfUrls.current.forEach((url) => URL.revokeObjectURL(url));
      pdfUrls.current = [];
    };
  }, []);

  const updateConversion = (id: string, changes: Partial<Conversion>) =>
    setConversions((list) => list.map((c) => (c.id === id ? { ...c, ...changes } : c)));

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const files = Array.from(newFiles);
    const pptxFiles = files.filter(isPptx);
    if (pptxFiles.length === 0) {
      const hasPpt = files.some((file) => file.name.toLowerCase().endsWith('.ppt'));
      setError(hasPpt
        ? "Old .ppt files aren't supported. Open them in PowerPoint and save them as .pptx first."
        : "No PowerPoint files found. Please select or drop files ending with .pptx.");
      return;
    }
    setError(null);

    const added: Conversion[] = pptxFiles.map((file) => ({
      id: `pptx-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      file,
      status: 'waiting',
    }));
    setConversions((list) => [...list, ...added]);

    for (const { id, file } of added) {
      queue.current = queue.current.then(async () => {
        if (!mounted.current) return;
        updateConversion(id, { status: 'converting' });
        try {
          const { pptxToPdf } = await import('./pptx/pptxToPdf');
          const pdf = await pptxToPdf(file, (message) => updateConversion(id, { progress: message }), fontFiles);
          if (!mounted.current) return;
          const pdfUrl = URL.createObjectURL(new Blob([pdf], { type: 'application/pdf' }));
          pdfUrls.current.push(pdfUrl);
          updateConversion(id, { status: 'done', pdfUrl });
        } catch (err) {
          console.error(`Error converting ${file.name}:`, err);
          updateConversion(id, { status: 'error', error: err instanceof Error ? err.message : String(err) });
        }
      });
    }
  }, [fontFiles]);

  const handleZoneDragOver = useCallback((event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = 'copy'; setIsDraggingOverZone(true);
  }, []);
  const handleZoneDragLeave = useCallback((event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault(); event.stopPropagation();
    if (!event.currentTarget.contains(event.relatedTarget as Node)) setIsDraggingOverZone(false);
  }, []);
  const handleZoneDrop = useCallback((event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault(); event.stopPropagation(); setIsDraggingOverZone(false);
    if (event.dataTransfer.files.length > 0) addFiles(event.dataTransfer.files);
  }, [addFiles]);
  const handleFileSelect = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) addFiles(event.target.files);
    event.target.value = '';
  }, [addFiles]);
  const handleBrowseClick = useCallback(() => fileInputRef.current?.click(), []);

  return (
    <div className="max-w-4xl mx-auto p-6 bg-gray-700 shadow-lg rounded-lg text-gray-200">
      <h2 className="text-2xl font-bold text-orange-400 mb-2">PPTX to PDF</h2>
      <p className="text-gray-300 mb-4">
        Convert PowerPoint (.pptx) files to searchable PDFs. Everything runs in your browser, so your files are never uploaded.
        LibreOffice handles the conversion. Fonts and some PowerPoint features can still look different; export a PDF from PowerPoint when an exact match is required. The conversion engine loads on first use (about 80 MB).
      </p>
      <PresentationFonts files={fontFiles} onChange={setFontFiles}
        disabled={conversions.some((conversion) => conversion.status === 'waiting' || conversion.status === 'converting')} />
      <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileSelect} multiple accept={`${PPTX_MIME},.pptx`} />

      <div
        id="drop-zone-pptx"
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors duration-200
          ${isDraggingOverZone ? 'border-orange-400 bg-gray-600' : 'border-gray-500 hover:border-orange-500 hover:bg-gray-600'}`}
        onDragEnter={handleZoneDragOver} onDragLeave={handleZoneDragLeave}
        onDragOver={handleZoneDragOver} onDrop={handleZoneDrop}
        onClick={handleBrowseClick} role="button" tabIndex={0}
        title="Drag and drop PPTX files here, or click to select files"
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleBrowseClick(); }}
      >
        <p>Drag & drop PPTX files here, or click to select</p>
      </div>

      {error && <p className="mt-4 p-3 bg-red-900 text-red-100 rounded-md">Error: {error}</p>}

      {conversions.length > 0 && (
        <ul className="mt-6 bg-gray-800 p-4 rounded-md space-y-2">
          {conversions.map((conversion) => (
            <li key={conversion.id} className="p-3 flex justify-between items-center gap-4 rounded border border-gray-600 bg-gray-700">
              <span className="text-sm text-gray-200 truncate" title={conversion.file.name}>{conversion.file.name}</span>
              {conversion.status === 'waiting' && <span className="text-sm text-gray-400 flex-shrink-0">Waiting...</span>}
              {conversion.status === 'converting' && (
                <span className="text-sm text-gray-300 flex-shrink-0">Converting{conversion.progress ? ` (${conversion.progress})` : ''}...</span>
              )}
              {conversion.status === 'error' && (
                <span className="text-sm text-red-400 truncate" title={conversion.error}>Failed: {conversion.error}</span>
              )}
              {conversion.status === 'done' && conversion.pdfUrl && (
                <a
                  href={conversion.pdfUrl}
                  download={pdfName(conversion.file)}
                  className="bg-orange-500 hover:bg-orange-600 text-gray-100 text-sm py-1.5 px-4 rounded-md transition-colors flex-shrink-0"
                >
                  Download PDF
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default PptxConverter;
