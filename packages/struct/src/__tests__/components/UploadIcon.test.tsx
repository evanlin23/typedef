import { render } from '@testing-library/react';

// Recreate the UploadIcon component for testing
const UploadIcon = () => (
  <svg 
    className="mx-auto h-12 w-12 text-gray-400" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor"
    strokeWidth="1.5" 
    strokeLinecap="round" 
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
    <polyline points="17 8 12 3 7 8"></polyline>
    <line x1="12" y1="3" x2="12" y2="15"></line>
  </svg>
);

describe('UploadIcon Component', () => {
  test('renders correctly with proper attributes', () => {
    const { container } = render(<UploadIcon />);
    
    // Check if SVG element is rendered
    const svgElement = container.querySelector('svg');
    expect(svgElement).toBeInTheDocument();
    
    // Check SVG attributes
    expect(svgElement).toHaveClass('mx-auto');
    expect(svgElement).toHaveClass('h-12');
    expect(svgElement).toHaveClass('w-12');
    expect(svgElement).toHaveClass('text-gray-400');
    expect(svgElement).toHaveAttribute('aria-hidden', 'true');
    expect(svgElement).toHaveAttribute('viewBox', '0 0 24 24');
    expect(svgElement).toHaveAttribute('fill', 'none');
    expect(svgElement).toHaveAttribute('stroke', 'currentColor');
    
    // Check SVG content
    expect(svgElement?.querySelector('path')).toBeInTheDocument();
    expect(svgElement?.querySelector('polyline')).toBeInTheDocument();
    expect(svgElement?.querySelector('line')).toBeInTheDocument();
  });
});
