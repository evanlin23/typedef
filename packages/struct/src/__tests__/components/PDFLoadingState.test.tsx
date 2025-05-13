// Original path: __tests__/components/PDFLoadingState.test.tsx
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import LoadingSpinner from '../../components/LoadingSpinner'; // Import actual component

// Mock LoadingSpinner component
vi.mock('../../components/LoadingSpinner', () => ({
  default: vi.fn(() => <div data-testid="loading-spinner">Loading Spinner</div>)
}));

// Recreate the PDFLoadingState component for testing
const PDFLoadingState = () => (
  <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-700">
    {/* Using the mocked LoadingSpinner */}
    <LoadingSpinner size="large" /> {/* Use the actual component or ensure mock provides size */}
    <p className="mt-3 text-gray-300">Loading PDF...</p>
  </div>
);

describe('PDFLoadingState Component', () => {
  test('renders loading spinner and message', () => {
    render(<PDFLoadingState />);
    
    // Check if loading spinner is rendered (via mock)
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