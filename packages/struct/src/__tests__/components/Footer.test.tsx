import { render, screen } from '@testing-library/react';
import { expect, describe, test } from 'vitest';
import Footer from '../../components/Footer';

// Add the necessary matchers for testing-library
declare global {
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

describe('Footer Component', () => {
  test('renders correctly', () => {
    render(<Footer />);
    
    // Check if the footer element exists
    const footerElement = screen.getByRole('contentinfo');
    expect(footerElement).toBeInTheDocument();
    expect(footerElement).toHaveAttribute('class', expect.stringContaining('bg-gray-800'));
  });

  test('renders GitHub link correctly', () => {
    render(<Footer />);
    
    // Check GitHub link
    const githubLink = screen.getByText('GitHub');
    expect(githubLink).toBeInTheDocument();
    expect(githubLink).toHaveAttribute('href', 'https://github.com/evanlin23/typedef');
    expect(githubLink).toHaveAttribute('target', '_blank');
    expect(githubLink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  test('has the correct styling classes', () => {
    render(<Footer />);
    
    // Check styling classes
    const footerElement = screen.getByRole('contentinfo');
    expect(footerElement).toHaveAttribute('class', expect.stringContaining('py-6'));
    expect(footerElement).toHaveAttribute('class', expect.stringContaining('mt-auto'));
    expect(footerElement).toHaveAttribute('class', expect.stringContaining('border-t'));
    
    // Check GitHub link styling
    const githubLink = screen.getByText('GitHub');
    expect(githubLink).toHaveAttribute('class', expect.stringContaining('text-purple-400'));
    expect(githubLink).toHaveAttribute('class', expect.stringContaining('hover:text-purple-300'));
  });
});
