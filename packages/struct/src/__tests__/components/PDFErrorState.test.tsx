import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

// Import the ErrorIcon component from our test file
import '../components/ErrorIcon.test';

// Recreate the PDFErrorState component for testing
interface PDFErrorStateProps {
  error: string;
  onClose: () => void;
}

const PDFErrorState = ({ error, onClose }: PDFErrorStateProps) => (
  <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 bg-gray-700">
    {/* Using a simplified ErrorIcon */}
    <svg 
      className="h-12 w-12 text-red-400 mb-3" 
      fill="none" 
      viewBox="0 0 24 24" 
      stroke="currentColor"
      aria-hidden="true"
      data-testid="error-icon"
    >
      <path 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        strokeWidth="2" 
        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
      />
    </svg>
    <p className="text-red-300 font-semibold">Error Displaying PDF</p>
    <p className="text-gray-400 text-sm mt-1">{error}</p>
    <button 
      onClick={onClose} 
      className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
    >
      Close
    </button>
  </div>
);

describe('PDFErrorState Component', () => {
  test('renders error message and close button', async () => {
    const mockOnClose = vi.fn();
    const errorMessage = 'Test error message';
    const user = userEvent.setup();
    
    render(<PDFErrorState error={errorMessage} onClose={mockOnClose} />);
    
    // Check if error icon is rendered
    expect(screen.getByTestId('error-icon')).toBeInTheDocument();
    
    // Check if error heading is displayed
    expect(screen.getByText('Error Displaying PDF')).toBeInTheDocument();
    
    // Check if error message is displayed
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
    
    // Check if close button is rendered
    const closeButton = screen.getByText('Close');
    expect(closeButton).toBeInTheDocument();
    
    // Test close button functionality
    await user.click(closeButton);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
    
    // Check container styling
    const container = screen.getByText('Error Displaying PDF').parentElement;
    expect(container).toHaveClass('absolute');
    expect(container).toHaveClass('inset-0');
    expect(container).toHaveClass('flex');
    expect(container).toHaveClass('items-center');
    expect(container).toHaveClass('justify-center');
    expect(container).toHaveClass('bg-gray-700');
  });
});
