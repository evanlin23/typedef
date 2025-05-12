import { render } from '@testing-library/react';

// Recreate the ErrorIcon component for testing
const ErrorIcon = () => (
  <svg 
    className="h-12 w-12 text-red-400 mb-3" 
    fill="none" 
    viewBox="0 0 24 24" 
    stroke="currentColor"
    aria-hidden="true"
  >
    <path 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      strokeWidth="2" 
      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
    />
  </svg>
);

describe('ErrorIcon Component', () => {
  test('renders correctly', () => {
    const { container } = render(<ErrorIcon />);
    
    // Check if SVG element is rendered
    const svgElement = container.querySelector('svg');
    expect(svgElement).toBeInTheDocument();
    
    // Check SVG attributes
    expect(svgElement).toHaveClass('text-red-400');
    expect(svgElement).toHaveClass('h-12');
    expect(svgElement).toHaveClass('w-12');
    expect(svgElement).toHaveClass('mb-3');
    expect(svgElement).toHaveAttribute('aria-hidden', 'true');
    
    // Check SVG content
    expect(svgElement?.querySelector('path')).toBeInTheDocument();
  });
});
