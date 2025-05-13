// src/__tests__/components/PDFViewer.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom'; // For context if any child needs it
import PDFViewer from '../../components/PDFViewer';
import type { PDF } from '../../utils/types';

// NO LONGER MOCKING useNavigate, PDFViewer itself doesn't navigate.
// Its onClose prop is called, and the wrapper handles navigation.

vi.mock('../../components/LoadingSpinner', () => ({
  default: vi.fn(() => <div data-testid="loading-spinner">Loading Spinner</div>)
}));

const mockObjectUrl = 'blob:mock-url';
global.URL.createObjectURL = vi.fn(() => mockObjectUrl);
global.URL.revokeObjectURL = vi.fn();

// Helper to render with Router context if needed by children (unlikely for PDFViewer)
const renderWithRouter = (component: React.ReactElement) => {
  return render(<MemoryRouter>{component}</MemoryRouter>);
};

describe('PDFViewer Component', () => {
  const mockPDF: PDF = {
    id: 1, name: 'Test PDF.pdf', dateAdded: Date.now(), size: 1048576, status: 'to-study', classId: 'class-1', lastModified: Date.now(), data: new Uint8Array([1, 2, 3])
  };

  const mockProps = {
    pdf: mockPDF,
    onClose: vi.fn(), // This prop is called by PDFViewer
    onStatusChange: vi.fn().mockResolvedValue(undefined),
    classNotes: 'Initial class notes',
    onClassNotesChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset createObjectURL to its default mock for each test if needed, or ensure it's clean.
    vi.mocked(global.URL.createObjectURL).mockReturnValue(mockObjectUrl);

    Object.defineProperty(HTMLIFrameElement.prototype, 'src', {
      set: function(srcVal: string) { // Use a different variable name
        this.setAttribute('src', srcVal);
        setTimeout(() => {
          const loadEvent = new Event('load');
          this.dispatchEvent(loadEvent);
        }, 10);
      },
      configurable: true
    });
  });

  test('renders correctly with PDF data', async () => {
    renderWithRouter(<PDFViewer {...mockProps} />);
    expect(screen.getByText('Test PDF.pdf')).toBeInTheDocument();
    expect(screen.getByText('Mark as Done')).toBeInTheDocument();
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });
    const iframe = screen.getByTitle('PDF Viewer: Test PDF.pdf');
    expect(iframe).toBeInTheDocument();
    expect(screen.getByLabelText('Class notes')).toHaveValue('Initial class notes');
  });

  test('calls onStatusChange prop when status toggle button is clicked', async () => {
    const user = userEvent.setup();
    renderWithRouter(<PDFViewer {...mockProps} />);
    await waitFor(() => expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument());
    await user.click(screen.getByText('Mark as Done'));
    expect(mockProps.onStatusChange).toHaveBeenCalledWith(1, 'done');
  });

  test('calls onClose prop when close button is clicked', async () => {
    const user = userEvent.setup();
    renderWithRouter(<PDFViewer {...mockProps} />);
    await waitFor(() => expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument());
    await user.click(screen.getByText('Close (Esc)'));
    expect(mockProps.onClose).toHaveBeenCalledTimes(1);
  });

  test('calls onClose prop when Escape key is pressed', async () => {
    renderWithRouter(<PDFViewer {...mockProps} />);
    await waitFor(() => expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument());
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(mockProps.onClose).toHaveBeenCalledTimes(1);
  });

  test('calls onClassNotesChange prop when typing in notes', async () => {
    const user = userEvent.setup();
    renderWithRouter(<PDFViewer {...mockProps} />);
    await waitFor(() => expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument());
    const notesTextarea = screen.getByLabelText('Class notes');
    await user.clear(notesTextarea);
    await user.type(notesTextarea, 'New notes');
    expect(mockProps.onClassNotesChange).toHaveBeenCalledWith('New notes');
  });

  test('flushes notes by calling onClassNotesChange via onClose prop pathway', async () => {
    const user = userEvent.setup();
    // localNotes state is internal, but we test that onClose is called,
    // and the wrapper is responsible for ensuring notes are flushed.
    // The PDFViewer's own `flushDebouncedNotes` calls `onClassNotesChange` if needed.
    renderWithRouter(<PDFViewer {...mockProps} />);
    await waitFor(() => expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument());

    const notesTextarea = screen.getByLabelText('Class notes');
    await user.clear(notesTextarea);
    await user.type(notesTextarea, 'Modified notes');

    mockProps.onClassNotesChange.mockClear(); // Clear to see if flush triggers it
    mockProps.onClose.mockClear();

    await user.click(screen.getByText('Close (Esc)'));

    expect(mockProps.onClose).toHaveBeenCalledTimes(1);
    // The PDFViewer's internal `flushDebouncedNotes` should call onClassNotesChange before calling onClose.
    // This means `onClassNotesChange` should have been called with 'Modified notes'.
    // The App's `useClassNotes` hook will then debounce the actual DB save.
    expect(mockProps.onClassNotesChange).toHaveBeenCalledWith('Modified notes');
  });


  test('handles missing PDF data (pdf.data is undefined)', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderWithRouter(<PDFViewer {...mockProps} pdf={{ ...mockPDF, data: undefined }}/>);
    await waitFor(() => {
      expect(screen.getByText('Error Displaying PDF')).toBeInTheDocument();
      expect(screen.getByText('PDF data is missing.')).toBeInTheDocument();
    });
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    consoleWarnSpy.mockRestore();
  });

  test('handles error in PDF blob creation (URL.createObjectURL throws)', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(URL.createObjectURL).mockImplementationOnce(() => {
      throw new Error('Blob creation error');
    });
    renderWithRouter(<PDFViewer {...mockProps} />);
    await waitFor(() => {
      expect(screen.getByText('Error Displaying PDF')).toBeInTheDocument();
      expect(screen.getByText('Failed to prepare PDF for viewing. The file might be corrupted.')).toBeInTheDocument();
    });
    consoleErrorSpy.mockRestore();
  });


  test('handles iframe load error', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    Object.defineProperty(HTMLIFrameElement.prototype, 'src', {
      set: function(srcVal: string) { // Use a different variable name
        this.setAttribute('src', srcVal);
        setTimeout(() => { this.dispatchEvent(new Event('error')); }, 10);
      },
      configurable: true
    });
    renderWithRouter(<PDFViewer {...mockProps} />);
    await waitFor(() => {
      expect(screen.getByText('Error Displaying PDF')).toBeInTheDocument();
      expect(screen.getByText('The PDF could not be displayed. It might be corrupted or an unsupported format.')).toBeInTheDocument();
    });
    consoleErrorSpy.mockRestore();
  });

  test('updates local notes when classNotes prop changes', async () => {
    const { rerender } = renderWithRouter(<PDFViewer {...mockProps} />);
    await waitFor(() => expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument());
    const notesTextarea = screen.getByLabelText('Class notes');
    expect(notesTextarea).toHaveValue('Initial class notes');

    rerender(
      <MemoryRouter>
        <PDFViewer {...mockProps} classNotes="Updated notes from prop" />
      </MemoryRouter>
    );
    expect(notesTextarea).toHaveValue('Updated notes from prop');
  });
});