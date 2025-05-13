// Original path: __tests__/components/LoadingSpinner.test.tsx
import { render, screen } from '@testing-library/react';
import LoadingSpinner from '../../components/LoadingSpinner';

describe('LoadingSpinner Component', () => {
  test('renders correctly with default props', () => {
    render(<LoadingSpinner />);
    
    const spinner = screen.getByRole('status');
    expect(spinner).toBeInTheDocument();
    expect(spinner).toHaveClass('animate-spin', 'rounded-full', 'border-green-400');
    expect(spinner).toHaveClass('h-12', 'w-12'); // Default medium size
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  test('renders small size correctly', () => {
    render(<LoadingSpinner size="small" />);
    
    const spinner = screen.getByRole('status');
    expect(spinner).toHaveClass('h-8', 'w-8', 'border-2');
  });

  test('renders large size correctly', () => {
    render(<LoadingSpinner size="large" />);
    
    const spinner = screen.getByRole('status');
    expect(spinner).toHaveClass('h-16', 'w-16', 'border-t-4', 'border-b-4');
  });

  test('applies custom className correctly', () => {
    render(<LoadingSpinner className="mt-8 text-red-500" />);
    
    const container = screen.getByRole('status').parentElement;
    expect(container).toHaveClass('mt-8', 'text-red-500');
  });

  test('has correct accessibility attributes', () => {
    render(<LoadingSpinner />);
    
    const spinner = screen.getByRole('status');
    expect(spinner).toHaveAttribute('aria-live', 'polite');
    expect(spinner).toHaveAttribute('aria-label', 'Loading...');
    
    // Screen reader text should be visually hidden but present in the DOM
    const srText = screen.getByText('Loading...');
    expect(srText).toHaveClass('sr-only');
  });
});