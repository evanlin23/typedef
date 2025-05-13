// Original path: __tests__/components/ProgressStats.test.tsx
import { render, screen } from '@testing-library/react';
import { vi, expect, describe, test } from 'vitest';
import ProgressStats from '../../components/ProgressStats';

// Mock the ProgressBar component
vi.mock('../../components/ProgressBar', () => ({
  default: vi.fn(({ progress, completedItems, totalItems }) => (
    <div data-testid="progress-bar">
      <div data-testid="progress-value">{progress}%</div>
      <div data-testid="progress-completed">{completedItems}/{totalItems}</div>
    </div>
  ))
}));

// Add the necessary matchers for testing-library
 
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Vi {
    interface AsymmetricMatchersContaining {
      toBeInTheDocument(): void;
      toHaveTextContent(text: string | RegExp): void;
      toHaveAttribute(attr: string, value?: string): void;
    }
    
    interface Assertion {
      toBeInTheDocument(): Assertion;
      toHaveTextContent(text: string | RegExp): Assertion;
      toHaveAttribute(attr: string, value?: string): Assertion;
      not: Assertion;
    }
  }
}

describe('ProgressStats Component', () => {
  test('renders correctly with stats', () => {
    const stats = {
      total: 10,
      toStudy: 7,
      done: 3
    };
    
    render(<ProgressStats stats={stats} />);
    
    // Check heading
    expect(screen.getByText('Class Progress')).toBeInTheDocument();
    
    // Check progress bar component is rendered
    expect(screen.getByTestId('progress-bar')).toBeInTheDocument();
    
    // Check if progress percentage is calculated correctly (3/10 = 30%)
    expect(screen.getByTestId('progress-value')).toHaveTextContent('30%');
    
    // Check if completed/total is displayed correctly
    expect(screen.getByTestId('progress-completed')).toHaveTextContent('3/10');
    
    // Check stat section headings
    expect(screen.getByText('To Study')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    
    // Check stat values
    expect(screen.getByText('7')).toBeInTheDocument(); // toStudy count
    expect(screen.getByText('3')).toBeInTheDocument(); // done count
  });

  test('handles zero total pdfs', () => {
    const stats = {
      total: 0,
      toStudy: 0,
      done: 0
    };
    
    render(<ProgressStats stats={stats} />);
    
    // Progress should be 0% when there are no PDFs
    expect(screen.getByTestId('progress-value')).toHaveTextContent('0%');
    expect(screen.getByTestId('progress-completed')).toHaveTextContent('0/0');
    
    // Stats should show zeros - use getAllByText since there are multiple zeros
    const zeroElements = screen.getAllByText('0');
    expect(zeroElements.length).toBeGreaterThanOrEqual(2); // At least 2 zeros (toStudy and done)
  });

  test('handles 100% completion', () => {
    const stats = {
      total: 5,
      toStudy: 0,
      done: 5
    };
    
    render(<ProgressStats stats={stats} />);
    
    // Progress should be 100% when all PDFs are done
    expect(screen.getByTestId('progress-value')).toHaveTextContent('100%');
    expect(screen.getByTestId('progress-completed')).toHaveTextContent('5/5');
    
    // Stats should show correct values
    expect(screen.getByText('0')).toBeInTheDocument(); // toStudy count
    expect(screen.getByText('5')).toBeInTheDocument(); // done count
  });

  test('rounds progress percentage correctly', () => {
    const stats = {
      total: 3,
      toStudy: 2,
      done: 1
    };
    
    render(<ProgressStats stats={stats} />);
    
    // 1/3 = 33.33%, should be rounded to 33%
    expect(screen.getByTestId('progress-value')).toHaveTextContent('33%');
  });

  test('applies correct styling classes', () => {
    const stats = {
      total: 10,
      toStudy: 7,
      done: 3
    };
    
    render(<ProgressStats stats={stats} />);
    
    // Check container styling
    const container = screen.getByText('Class Progress').closest('div');
    expect(container).toHaveAttribute('class', expect.stringContaining('bg-gray-800'));
    expect(container).toHaveAttribute('class', expect.stringContaining('rounded-lg'));
    expect(container).toHaveAttribute('class', expect.stringContaining('p-6'));
    expect(container).toHaveAttribute('class', expect.stringContaining('shadow-lg'));
    
    // Check the stat cards styling
    const statCards = screen.getAllByText(/To Study|Completed/);
    statCards.forEach(card => {
      const cardContainer = card.closest('div');
      expect(cardContainer).toHaveAttribute('class', expect.stringContaining('bg-gray-900'));
      expect(cardContainer).toHaveAttribute('class', expect.stringContaining('rounded-lg'));
      expect(cardContainer).toHaveAttribute('class', expect.stringContaining('text-center'));
    });
    
    // Check specific colors for stat values
    const toStudyValue = screen.getByText('7');
    expect(toStudyValue).toHaveAttribute('class', expect.stringContaining('text-blue-400'));
    
    const completedValue = screen.getByText('3');
    expect(completedValue).toHaveAttribute('class', expect.stringContaining('text-green-400'));
  });
});