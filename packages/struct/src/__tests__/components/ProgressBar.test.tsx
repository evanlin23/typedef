// Original path: __tests__/components/ProgressBar.test.tsx
import { render, screen } from '@testing-library/react';
import ProgressBar from '../../components/ProgressBar';

describe('ProgressBar Component', () => {
  test('renders correctly with default props', () => {
    render(
      <ProgressBar 
        progress={50} 
        completedItems={5} 
        totalItems={10} 
      />
    );
    
    // Check text elements
    expect(screen.getByText('Progress')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('5 of 10 completed')).toBeInTheDocument();
    
    // Check progress bar
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toBeInTheDocument();
    expect(progressBar).toHaveAttribute('aria-valuenow', '50');
    expect(progressBar).toHaveAttribute('aria-valuemin', '0');
    expect(progressBar).toHaveAttribute('aria-valuemax', '100');
    expect(progressBar).toHaveAttribute('aria-label', 'Progress: 50%');
    expect(progressBar).toHaveStyle({ width: '50%' });
    
    // Check default height
    expect(progressBar).toHaveClass('h-2');
  });

  test('applies yellow color for medium progress', () => {
    render(
      <ProgressBar 
        progress={50} 
        completedItems={5} 
        totalItems={10} 
      />
    );
    
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveClass('bg-yellow-500');
  });

  test('applies red color for low progress', () => {
    render(
      <ProgressBar 
        progress={20} 
        completedItems={2} 
        totalItems={10} 
      />
    );
    
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveClass('bg-red-500');
  });

  test('applies green color for high progress', () => {
    render(
      <ProgressBar 
        progress={80} 
        completedItems={8} 
        totalItems={10} 
      />
    );
    
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveClass('bg-green-500');
  });

  test('normalizes progress values outside 0-100 range', () => {
    render(
      <ProgressBar 
        progress={120} 
        completedItems={10} 
        totalItems={10} 
      />
    );
    
    expect(screen.getByText('100%')).toBeInTheDocument();
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuenow', '100');
    expect(progressBar).toHaveStyle({ width: '100%' });
  });

  test('applies custom bar height', () => {
    render(
      <ProgressBar 
        progress={50} 
        completedItems={5} 
        totalItems={10}
        barHeight="h-4" 
      />
    );
    
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveClass('h-4');
    expect(progressBar.parentElement).toHaveClass('h-4');
  });

  test('hides completed count when totalItems is 0', () => {
    render(
      <ProgressBar 
        progress={0} 
        completedItems={0} 
        totalItems={0} 
      />
    );
    
    expect(screen.queryByText(/of/)).not.toBeInTheDocument();
  });
});