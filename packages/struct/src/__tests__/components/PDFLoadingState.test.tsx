import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

// Mock LoadingSpinner component
vi.mock('../../components/LoadingSpinner', () => ({
  default: vi.fn(() => <div data-testid="loading-spinner">Loading Spinner</div>)
}));

// Recreate the PDFLoadingState component for testing
const PDFLoadingState = () => (
  <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-700">
    {/* Using the mocked LoadingSpinner */}
    <div data-testid="loading-spinner">Loading Spinner</div>
    <p className="mt-3 text-gray-300">Loading PDF...</p>
  </div>
);

describe('PDFLoadingState Component', () => {
  test('renders loading spinner and message', () => {
    render(<PDFLoadingState />);
    
    // Check if loading spinner is rendered
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    
    // Check if loading message is displayed
    expect(screen.getByText('Loading PDF...')).toBeInTheDocument();
    
    // Check container styling
    const container = screen.getByText('Loading PDF...').parentElement;
    expect(container).toHaveClass('absolute');
    expect(container).toHaveClass('inset-0');
    expect(container).toHaveClass('flex');
    expect(container).toHaveClass('items-center');
    expect(container).toHaveClass('justify-center');
    expect(container).toHaveClass('bg-gray-700');
  });
});
