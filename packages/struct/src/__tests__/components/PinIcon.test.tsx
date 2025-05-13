// Original path: __tests__/components/PinIcon.test.tsx
import { render } from '@testing-library/react';
import { expect, describe, test } from 'vitest';
import PinIcon from '../../components/PinIcon';

// Add the necessary matchers for testing-library
 
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Vi {
    interface AsymmetricMatchersContaining {
      toBeInTheDocument(): void;
      toHaveAttribute(attr: string, value?: string): void;
    }
    
    interface Assertion {
      toBeInTheDocument(): Assertion;
      toHaveAttribute(attr: string, value?: string): Assertion;
      not: Assertion;
    }
  }
}

describe('PinIcon Component', () => {
  test('renders correctly when pinned', () => {
    render(<PinIcon isPinned={true} />);
    
    // Check if the SVG element exists
    const svgElement = document.querySelector('svg');
    expect(svgElement).toBeInTheDocument();
    
    // When pinned, the fill attribute should be 'currentColor'
    expect(svgElement).toHaveAttribute('fill', 'currentColor');
    expect(svgElement).toHaveAttribute('stroke', 'currentColor');
    expect(svgElement).toHaveAttribute('aria-hidden', 'true');
  });

  test('renders correctly when not pinned', () => {
    render(<PinIcon isPinned={false} />);
    
    // Check if the SVG element exists
    const svgElement = document.querySelector('svg');
    expect(svgElement).toBeInTheDocument();
    
    // When not pinned, the fill attribute should be 'none'
    expect(svgElement).toHaveAttribute('fill', 'none');
    expect(svgElement).toHaveAttribute('stroke', 'currentColor');
  });

  test('applies default className', () => {
    render(<PinIcon isPinned={true} />);
    
    const svgElement = document.querySelector('svg');
    expect(svgElement).toHaveAttribute('class', 'h-5 w-5');
  });

  test('applies custom className', () => {
    const customClass = 'h-8 w-8 text-red-500';
    render(<PinIcon isPinned={true} className={customClass} />);
    
    const svgElement = document.querySelector('svg');
    expect(svgElement).toHaveAttribute('class', customClass);
  });

  test('renders with correct SVG attributes', () => {
    render(<PinIcon isPinned={true} />);
    
    const svgElement = document.querySelector('svg');
    expect(svgElement).toHaveAttribute('viewBox', '0 0 24 24');
    expect(svgElement).toHaveAttribute('stroke-width', '2');
    expect(svgElement).toHaveAttribute('stroke-linecap', 'round');
    expect(svgElement).toHaveAttribute('stroke-linejoin', 'round');
  });

  test('contains expected SVG child elements', () => {
    render(<PinIcon isPinned={true} />);
    
    // Check for line element
    const lineElement = document.querySelector('line');
    expect(lineElement).toBeInTheDocument();
    expect(lineElement).toHaveAttribute('x1', '12');
    expect(lineElement).toHaveAttribute('y1', '17');
    expect(lineElement).toHaveAttribute('x2', '12');
    expect(lineElement).toHaveAttribute('y2', '22');
    
    // Check for path element
    const pathElement = document.querySelector('path');
    expect(pathElement).toBeInTheDocument();
    expect(pathElement).toHaveAttribute('d', expect.stringContaining('M5 17h14'));
  });
});