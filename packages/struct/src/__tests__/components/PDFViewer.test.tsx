import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import PDFViewer from '../../components/PDFViewer';
import type { PDF } from '../../utils/types';

// Mock LoadingSpinner component
vi.mock('../../components/LoadingSpinner', () => ({
  default: vi.fn(() => <div data-testid="loading-spinner">Loading Spinner</div>)
}));

// Mock URL.createObjectURL and URL.revokeObjectURL
const mockObjectUrl = 'blob:mock-url';
global.URL.createObjectURL = vi.fn(() => mockObjectUrl);
global.URL.revokeObjectURL = vi.fn();

describe('PDFViewer Component', () => {
  const mockPDF: PDF = {
    id: 1,
    name: 'Test PDF.pdf',
    dateAdded: Date.now(),
    size: 1024 * 1024,
    status: 'to-study',
    classId: '123',
    data: new Uint8Array([1, 2, 3, 4]), // Mock PDF data
    order: 0
  };
  
  const mockProps = {
    pdf: mockPDF,
    onClose: vi.fn(),
    onStatusChange: vi.fn(),
    classNotes: 'Initial class notes',
    onClassNotesChange: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock iframe load event
    Object.defineProperty(HTMLIFrameElement.prototype, 'src', {
      set: function(src) {
        this.setAttribute('src', src);
        // Simulate iframe load event after a short delay
        setTimeout(() => {
          const loadEvent = new Event('load');
          this.dispatchEvent(loadEvent);
        }, 10);
      }
    });
  });

  test('renders correctly with PDF data', async () => {
    render(<PDFViewer {...mockProps} />);
    
    // Check header content
    expect(screen.getByText('Test PDF.pdf')).toBeInTheDocument();
    expect(screen.getByText('Mark as Done')).toBeInTheDocument();
    expect(screen.getByText('Close (Esc)')).toBeInTheDocument();
    
    // Should show loading spinner initially
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    
    // Should create object URL
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    
    // Wait for iframe to "load"
    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });
    
    // Check if iframe is visible
    const iframe = screen.getByTitle('PDF Viewer: Test PDF.pdf');
    expect(iframe).toBeInTheDocument();
    expect(iframe).not.toHaveClass('hidden');
    
    // Check notes section
    const notesTextarea = screen.getByLabelText('Class notes');
    expect(notesTextarea).toHaveValue('Initial class notes');
  });

  test('handles PDF status toggle', async () => {
    const user = userEvent.setup();
    render(<PDFViewer {...mockProps} />);
    
    // Wait for iframe to "load"
    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });
    
    // Click status toggle button
    await user.click(screen.getByText('Mark as Done'));
    
    expect(mockProps.onStatusChange).toHaveBeenCalledWith(1, 'done');
  });

  test('handles close button click', async () => {
    const user = userEvent.setup();
    render(<PDFViewer {...mockProps} />);
    
    // Wait for iframe to "load"
    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });
    
    // Click close button
    await user.click(screen.getByText('Close (Esc)'));
    
    expect(mockProps.onClose).toHaveBeenCalledTimes(1);
  });

  test('handles Escape key press', async () => {
    render(<PDFViewer {...mockProps} />);
    
    // Wait for iframe to "load"
    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });
    
    // Press Escape key
    fireEvent.keyDown(document, { key: 'Escape' });
    
    expect(mockProps.onClose).toHaveBeenCalledTimes(1);
  });

  test('updates notes when typing', async () => {
    const user = userEvent.setup();
    render(<PDFViewer {...mockProps} />);
    
    // Wait for iframe to "load"
    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });
    
    // Type in notes textarea
    const notesTextarea = screen.getByLabelText('Class notes');
    await user.clear(notesTextarea);
    await user.type(notesTextarea, 'New notes content');
    
    expect(mockProps.onClassNotesChange).toHaveBeenCalledWith('New notes content');
  });

  test('handles missing PDF data', async () => {
    // Mock console.warn to prevent test output pollution
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    render(
      <PDFViewer 
        {...mockProps} 
        pdf={{ ...mockPDF, data: undefined }}
      />
    );
    
    // Wait for error message to appear
    await waitFor(() => {
      expect(screen.getByText('Error Displaying PDF')).toBeInTheDocument();
      expect(screen.getByText('PDF data is missing.')).toBeInTheDocument();
    });
    
    // Loading spinner should be hidden
    expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    
    // URL.createObjectURL should not be called
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    
    // Restore console.warn
    consoleWarnSpy.mockRestore();
  });

  test('handles error in PDF blob creation', async () => {
    // Mock console.error to prevent test output pollution
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Mock URL.createObjectURL to throw an error
    (URL.createObjectURL as jest.Mock).mockImplementationOnce(() => {
      throw new Error('Blob creation error');
    });
    
    render(<PDFViewer {...mockProps} />);
    
    // Wait for error message to appear
    await waitFor(() => {
      expect(screen.getByText('Error Displaying PDF')).toBeInTheDocument();
      expect(screen.getByText('Failed to prepare PDF for viewing. The file might be corrupted.')).toBeInTheDocument();
    });
    
    // Loading spinner should be hidden
    expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    
    // Restore console.error
    consoleErrorSpy.mockRestore();
  });

  test('handles iframe load error', async () => {
    // Mock console.error to prevent test output pollution
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Override the iframe src setter to dispatch error instead of load
    Object.defineProperty(HTMLIFrameElement.prototype, 'src', {
      set: function(src) {
        this.setAttribute('src', src);
        // Simulate iframe error event after a short delay
        setTimeout(() => {
          const errorEvent = new Event('error');
          this.dispatchEvent(errorEvent);
        }, 10);
      }
    });
    
    render(<PDFViewer {...mockProps} />);
    
    // Wait for error message to appear
    await waitFor(() => {
      expect(screen.getByText('Error Displaying PDF')).toBeInTheDocument();
      expect(screen.getByText('The PDF could not be displayed. It might be corrupted or an unsupported format.')).toBeInTheDocument();
    });
    
    // Loading spinner should be hidden
    expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    
    // Restore console.error
    consoleErrorSpy.mockRestore();
  });

  test('updates local notes when classNotes prop changes', async () => {
    const { rerender } = render(<PDFViewer {...mockProps} />);
    
    // Wait for iframe to "load"
    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });
    
    // Check initial notes
    const notesTextarea = screen.getByLabelText('Class notes');
    expect(notesTextarea).toHaveValue('Initial class notes');
    
    // Update classNotes prop
    rerender(<PDFViewer {...mockProps} classNotes="Updated notes from prop" />);
    
    // Check if textarea value was updated
    expect(notesTextarea).toHaveValue('Updated notes from prop');
  });

  test('flushes notes when closing', async () => {
    const user = userEvent.setup();
    
    // Set up with modified notes that differ from prop
    render(<PDFViewer {...mockProps} />);
    
    // Wait for iframe to "load"
    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });
    
    // Type in notes textarea to modify it
    const notesTextarea = screen.getByLabelText('Class notes');
    await user.clear(notesTextarea);
    await user.type(notesTextarea, 'Modified notes');
    
    // Clear the mock to isolate the flush call
    mockProps.onClassNotesChange.mockClear();
    
    // Close the viewer
    await user.click(screen.getByText('Close (Esc)'));
    
    // onClassNotesChange should be called with the latest notes
    expect(mockProps.onClassNotesChange).toHaveBeenCalledWith('Modified notes');
  });
});
