import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import TabNavigation from '../../components/TabNavigation';
import type { TabType } from '../../components/TabNavigation';

describe('TabNavigation Component', () => {
  const mockProps = {
    activeTab: 'to-study' as TabType,
    onTabChange: vi.fn(),
    toStudyCount: 5,
    doneCount: 3
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders all tabs with correct counts', () => {
    render(<TabNavigation {...mockProps} />);
    
    // Check if all tabs are rendered with correct text
    expect(screen.getByText('To Study (5)')).toBeInTheDocument();
    expect(screen.getByText('Done (3)')).toBeInTheDocument();
    expect(screen.getByText('Notes')).toBeInTheDocument();
  });

  test('applies active styles to the active tab', () => {
    const { container } = render(<TabNavigation {...mockProps} />);
    
    // Get all tab buttons
    const buttons = container.querySelectorAll('button');
    
    // Check if the active tab has the active class
    expect(buttons[0]).toHaveClass('text-green-400');
    expect(buttons[0]).toHaveClass('border-green-400');
    
    // Check if inactive tabs have the inactive class
    expect(buttons[1]).toHaveClass('text-gray-400');
    expect(buttons[2]).toHaveClass('text-gray-400');
    
    // Check aria-current attribute
    expect(buttons[0]).toHaveAttribute('aria-current', 'true');
    expect(buttons[1]).toHaveAttribute('aria-current', 'false');
    expect(buttons[2]).toHaveAttribute('aria-current', 'false');
  });

  test('changes active tab when clicked', async () => {
    const user = userEvent.setup();
    render(<TabNavigation {...mockProps} />);
    
    // Click on the Done tab
    await user.click(screen.getByText('Done (3)'));
    
    // Check if onTabChange was called with 'done'
    expect(mockProps.onTabChange).toHaveBeenCalledWith('done');
    
    // Click on the Notes tab
    await user.click(screen.getByText('Notes'));
    
    // Check if onTabChange was called with 'notes'
    expect(mockProps.onTabChange).toHaveBeenCalledWith('notes');
  });

  test('renders with different active tab', () => {
    const { container } = render(
      <TabNavigation {...mockProps} activeTab="done" />
    );
    
    // Get all tab buttons
    const buttons = container.querySelectorAll('button');
    
    // Check if the active tab has the active class
    expect(buttons[1]).toHaveClass('text-green-400');
    expect(buttons[1]).toHaveClass('border-green-400');
    
    // Check if inactive tabs have the inactive class
    expect(buttons[0]).toHaveClass('text-gray-400');
    expect(buttons[2]).toHaveClass('text-gray-400');
    
    // Check aria-current attribute
    expect(buttons[0]).toHaveAttribute('aria-current', 'false');
    expect(buttons[1]).toHaveAttribute('aria-current', 'true');
    expect(buttons[2]).toHaveAttribute('aria-current', 'false');
  });

  test('renders with zero counts', () => {
    render(
      <TabNavigation
        activeTab="to-study"
        onTabChange={mockProps.onTabChange}
        toStudyCount={0}
        doneCount={0}
      />
    );
    
    // Check if tabs show zero counts
    expect(screen.getByText('To Study (0)')).toBeInTheDocument();
    expect(screen.getByText('Done (0)')).toBeInTheDocument();
  });
});
