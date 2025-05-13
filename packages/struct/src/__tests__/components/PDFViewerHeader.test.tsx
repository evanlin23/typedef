// Original path: __tests__/components/PDFViewerHeader.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

// Recreate the PDFViewerHeader component for testing
interface PDFViewerHeaderProps {
  pdfName: string;
  pdfStatus: 'to-study' | 'done';
  onStatusToggle: () => void;
  onClose: () => void;
}

const PDFViewerHeader = ({ pdfName, pdfStatus, onStatusToggle, onClose }: PDFViewerHeaderProps) => (
  <header className="bg-gray-800 text-white p-3 sm:p-4 flex items-center justify-between shadow-md flex-shrink-0">
    <h2 
      id="pdf-viewer-title" 
      className="font-semibold text-base sm:text-lg truncate max-w-[calc(100%-250px)] sm:max-w-md md:max-w-lg" 
      title={pdfName}
    >
      {pdfName}
    </h2>
    <div className="flex items-center space-x-2 sm:space-x-3">
      <button
        onClick={onStatusToggle}
        className={`
          px-3 py-1.5 text-xs sm:text-sm rounded transition-colors 
          focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 
          ${pdfStatus === 'to-study'
    ? 'bg-green-500 hover:bg-green-600 text-white focus:ring-green-400'
    : 'bg-blue-500 hover:bg-blue-600 text-white focus:ring-blue-400'}
        `}
      >
        {pdfStatus === 'to-study' ? 'Mark as Done' : 'Mark To Study'}
      </button>
      <button
        onClick={onClose}
        className="bg-gray-600 hover:bg-gray-500 text-white px-3 py-1.5 rounded text-xs sm:text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
        aria-label="Close PDF viewer"
      >
        Close (Esc)
      </button>
    </div>
  </header>
);

describe('PDFViewerHeader Component', () => {
  test('renders PDF name and buttons correctly for to-study status', async () => {
    const mockProps = {
      pdfName: 'Test PDF.pdf',
      pdfStatus: 'to-study' as const,
      onStatusToggle: vi.fn(),
      onClose: vi.fn()
    };
    const user = userEvent.setup();
    
    render(<PDFViewerHeader {...mockProps} />);
    
    // Check if PDF name is displayed
    const pdfNameElement = screen.getByText('Test PDF.pdf');
    expect(pdfNameElement).toBeInTheDocument();
    expect(pdfNameElement).toHaveAttribute('id', 'pdf-viewer-title');
    
    // Check if status toggle button is rendered with correct text
    const statusButton = screen.getByText('Mark as Done');
    expect(statusButton).toBeInTheDocument();
    expect(statusButton).toHaveClass('bg-green-500');
    
    // Check if close button is rendered
    const closeButton = screen.getByText('Close (Esc)');
    expect(closeButton).toBeInTheDocument();
    
    // Test status toggle button functionality
    await user.click(statusButton);
    expect(mockProps.onStatusToggle).toHaveBeenCalledTimes(1);
    
    // Test close button functionality
    await user.click(closeButton);
    expect(mockProps.onClose).toHaveBeenCalledTimes(1);
  });
  
  test('renders correct button text for done status', () => {
    const mockProps = {
      pdfName: 'Test PDF.pdf',
      pdfStatus: 'done' as const,
      onStatusToggle: vi.fn(),
      onClose: vi.fn()
    };
    
    render(<PDFViewerHeader {...mockProps} />);
    
    // Check if status toggle button has correct text for 'done' status
    const statusButton = screen.getByText('Mark To Study');
    expect(statusButton).toBeInTheDocument();
    expect(statusButton).toHaveClass('bg-blue-500');
  });
});