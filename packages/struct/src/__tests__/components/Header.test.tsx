import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, expect, describe, test } from 'vitest';
import Header from '../../components/Header';

// Add the necessary matchers for testing-library
declare global {
  namespace Vi {
    interface AsymmetricMatchersContaining {
      toBeInTheDocument(): void;
      toHaveAttribute(attr: string, value?: string): void;
      toBeVisible(): void;
    }
    
    interface Assertion {
      toBeInTheDocument(): Assertion;
      toHaveAttribute(attr: string, value?: string): Assertion;
      toBeVisible(): Assertion;
      not: Assertion;
    }
  }
}

describe('Header Component', () => {
  test('renders correctly with default props', () => {
    render(<Header />);
    
    // Check if the header element exists
    const headerElement = screen.getByRole('banner');
    expect(headerElement).toBeInTheDocument();
    expect(headerElement).toHaveAttribute('class', expect.stringContaining('bg-gray-800'));
    
    // Check for the logo and app name
    expect(screen.getByLabelText('Application Logo and Name')).toBeInTheDocument();
    expect(screen.getByText('struct')).toBeInTheDocument();
    
    // Back button should not be visible with default props
    expect(screen.queryByLabelText('Go back')).not.toBeInTheDocument();
  });

  test('renders page title when provided', () => {
    render(<Header pageTitle="Test Page" />);
    
    // Check if the page title is displayed
    const pageTitleElement = screen.getByText('/ Test Page');
    expect(pageTitleElement).toBeInTheDocument();
    expect(pageTitleElement).toHaveAttribute('class', expect.stringContaining('text-gray-400'));
  });

  test('renders back button when showBackButton is true', () => {
    render(<Header showBackButton={true} />);
    
    // Check if the back button is displayed
    const backButton = screen.getByLabelText('Go back');
    expect(backButton).toBeInTheDocument();
    expect(backButton).toHaveAttribute('class', expect.stringContaining('text-gray-400'));
  });

  test('calls onBackClick when back button is clicked', async () => {
    const mockOnBackClick = vi.fn();
    const user = userEvent.setup();
    
    render(<Header showBackButton={true} onBackClick={mockOnBackClick} />);
    
    // Find and click the back button
    const backButton = screen.getByLabelText('Go back');
    await user.click(backButton);
    
    // Check if the onBackClick function was called
    expect(mockOnBackClick).toHaveBeenCalledTimes(1);
  });

  test('renders with both pageTitle and back button', () => {
    render(<Header pageTitle="Test Page" showBackButton={true} />);
    
    // Both page title and back button should be visible
    expect(screen.getByText('/ Test Page')).toBeInTheDocument();
    expect(screen.getByLabelText('Go back')).toBeInTheDocument();
  });

  test('has the correct styling classes', () => {
    render(<Header />);
    
    // Check styling classes on the header
    const headerElement = screen.getByRole('banner');
    expect(headerElement).toHaveAttribute('class', expect.stringContaining('py-4'));
    expect(headerElement).toHaveAttribute('class', expect.stringContaining('shadow-md'));
    expect(headerElement).toHaveAttribute('class', expect.stringContaining('sticky'));
    expect(headerElement).toHaveAttribute('class', expect.stringContaining('z-10'));
    
    // Check app title styling
    const titleElement = screen.getByText('struct');
    expect(titleElement).toHaveAttribute('class', expect.stringContaining('text-2xl'));
    expect(titleElement).toHaveAttribute('class', expect.stringContaining('font-bold'));
  });
});
