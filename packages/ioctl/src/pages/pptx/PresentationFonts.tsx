import { useState } from 'react';
import { canReadDeviceFonts, readDeviceOfficeFonts } from './deviceFonts';
import { loadPresentationFonts } from './presentationFonts';

interface Props {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
}

export default function PresentationFonts({ files, onChange, disabled }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const loadInstalled = async () => {
    setLoading(true); setError(undefined);
    try {
      const fonts = await readDeviceOfficeFonts();
      await loadPresentationFonts(fonts);
      onChange(fonts);
    } catch (error) { setError(error instanceof Error ? error.message : String(error)); }
    finally { setLoading(false); }
  };
  return (
    <details className="mb-4 rounded border border-gray-500 p-3">
      <summary className="cursor-pointer">Optional presentation fonts{files.length > 0 ? ` (${files.length} selected)` : ''}</summary>
      <p className="my-2 text-sm text-gray-300">
        Before starting conversion, load the original fonts from your device or select TTF, OTF or TTC files.
        Include the bold and italic variants your slides use. Fonts stay on your device and are used for PowerPoint conversion in this tool.
        Matching fonts can improve layout, but do not guarantee an exact PowerPoint appearance.
      </p>
      {canReadDeviceFonts() && <button type="button" disabled={disabled || loading} onClick={() => void loadInstalled()}
        className="mb-3 text-orange-400 underline">
        {loading ? 'Reading device fonts…' : 'Load installed Office fonts'}
      </button>}
      {error && <p role="alert" className="mb-2 text-sm text-red-300">{error}</p>}
      <label className="block text-sm">Presentation font files
        <input aria-label="Presentation font files" type="file" accept=".ttf,.otf,.ttc" multiple disabled={disabled || loading}
          className="block mt-2 w-full" onChange={(event) => {
            if (event.target.files) onChange(Array.from(event.target.files));
            event.target.value = '';
          }} />
      </label>
      {files.length > 0 && <div className="mt-2 text-sm">
        <p>{files.map((file) => file.name).join(', ')}</p>
        <button type="button" disabled={disabled || loading} className="mt-1 text-orange-400 underline" onClick={() => onChange([])}>Clear fonts</button>
      </div>}
    </details>
  );
}

