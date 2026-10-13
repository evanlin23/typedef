import type { ConversionBackend } from './conversionBackend';

interface Props {
  value: ConversionBackend;
  onChange: (value: ConversionBackend) => void;
  disabled?: boolean;
}

export default function ConversionSettings({ value, onChange, disabled }: Props) {
  return (
    <fieldset disabled={disabled} className="mb-4 p-4 border border-gray-500 rounded space-y-3">
      <legend className="px-2">PowerPoint conversion</legend>
      <label className="block">
        Convert with
        <select aria-label="Convert with" value={value.kind}
          onChange={(event) => onChange(event.target.value === 'cloudconvert'
            ? { kind: 'cloudconvert', apiKey: '' } : { kind: 'browser' })}
          className="ml-3 p-2 rounded bg-gray-800">
          <option value="browser">This browser (experimental)</option>
          <option value="cloudconvert">CloudConvert (your account)</option>
        </select>
      </label>
      {value.kind === 'browser' ? (
        <p className="text-sm text-gray-300">Files stay on your device. The engine downloads about 80 MB on first use. Complex lecture decks may time out or render differently.</p>
      ) : (
        <>
          <p className="text-sm text-gray-300">
            When you convert, your PPTX presentations are uploaded to CloudConvert. PDFs are combined on your device.
            You need your own account and API key. Check your account's current free allowance before converting;
            CloudConvert applies its own quotas and credit charges. This site provides no shared conversion credits.
          </p>
          <label className="block">CloudConvert API key
            <input aria-label="CloudConvert API key" type="password" autoComplete="off"
              spellCheck={false} value={value.apiKey}
              onChange={(event) => onChange({ kind: 'cloudconvert', apiKey: event.target.value })}
              className="block mt-1 p-2 w-full rounded bg-gray-800" />
          </label>
          <p className="text-sm text-gray-300">
            Use a key with task.read and task.write permissions. The key stays in this page's memory;
            it is cleared when you leave this tool.{' '}
            <a href="https://cloudconvert.com/dashboard/api/v2/keys" target="_blank" rel="noreferrer" className="text-orange-400 underline">Get an API key</a>{' · '}
            <a href="https://cloudconvert.com/pricing" target="_blank" rel="noreferrer" className="text-orange-400 underline">Check free allowance</a>
          </p>
        </>
      )}
      <p className="text-sm text-gray-300">Neither option guarantees an exact PowerPoint appearance. Fonts, equations and some graphics can differ.</p>
    </fieldset>
  );
}
