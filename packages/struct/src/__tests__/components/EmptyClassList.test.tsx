// Original path: __tests__/components/EmptyClassList.test.tsx

import { render, screen } from '@testing-library/react';
import EmptyClassList from '../../components/EmptyClassList';

describe('EmptyClassList Component', () => {
  test('renders correctly with empty state message', () => {
    render(<EmptyClassList />);
    
    expect(screen.getByText('No classes yet')).toBeInTheDocument();
    expect(screen.getByText('Create your first class to get started.')).toBeInTheDocument();
  });

  test('has the correct styling', () => {
    render(<EmptyClassList />);
    
    const container = screen.getByText('No classes yet').closest('div');
    expect(container).toHaveClass('text-center', 'py-12', 'bg-gray-800', 'rounded-lg', 'shadow-md');
    
    const heading = screen.getByText('No classes yet');
    expect(heading).toHaveClass('mt-4', 'text-lg', 'font-medium', 'text-gray-200');
    
    const paragraph = screen.getByText('Create your first class to get started.');
    expect(paragraph).toHaveClass('mt-1', 'text-sm', 'text-gray-400');
  });
});