import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import ClassList from '../../components/ClassList';
import type { Class } from '../../utils/types';

// Mock the ClassCard component to simplify testing
vi.mock('../../components/ClassCard', () => ({
  default: vi.fn(({ classData, onSelect, onRequestDelete }) => (
    <div 
      data-testid={`class-card-${classData.id}`}
      onClick={onSelect}
    >
      <div>{classData.name}</div>
      <button 
        data-testid={`delete-${classData.id}`}
        onClick={(e) => onRequestDelete(e)}
      >
        Delete
      </button>
    </div>
  ))
}));

// Mock the EmptyClassList component
vi.mock('../../components/EmptyClassList', () => ({
  default: vi.fn(() => <div data-testid="empty-list">No classes found</div>)
}));

describe('ClassList Component', () => {
  const mockClasses: Class[] = [
    {
      id: '1',
      name: 'Math 101',
      dateCreated: Date.now(),
      isPinned: true,
      totalItems: 5,
      completedItems: 2,
      progress: 40,
      pdfCount: 3,
      notes: 'Math class notes'
    },
    {
      id: '2',
      name: 'History 202',
      dateCreated: Date.now() - 86400000, // 1 day ago
      isPinned: false,
      totalItems: 3,
      completedItems: 1,
      progress: 33,
      pdfCount: 2,
      notes: 'History class notes'
    }
  ];
  
  const mockProps = {
    classes: mockClasses,
    showOnlyPinned: false,
    onTogglePinnedFilter: vi.fn(),
    onSelectClass: vi.fn(),
    onRequestDelete: vi.fn(),
    onDataChanged: vi.fn().mockResolvedValue(undefined)
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders correctly with classes', () => {
    render(<ClassList {...mockProps} />);
    
    expect(screen.getByText('Your Classes')).toBeInTheDocument();
    expect(screen.getByText('Show Pinned Only')).toBeInTheDocument();
    expect(screen.getByTestId('class-card-1')).toBeInTheDocument();
    expect(screen.getByTestId('class-card-2')).toBeInTheDocument();
  });

  test('renders EmptyClassList when no classes are provided', () => {
    render(
      <ClassList 
        {...mockProps} 
        classes={[]}
      />
    );
    
    expect(screen.getByTestId('empty-list')).toBeInTheDocument();
  });

  test('toggles pinned filter when button is clicked', async () => {
    const user = userEvent.setup();
    render(<ClassList {...mockProps} />);
    
    const filterButton = screen.getByRole('button', { name: /show pinned only/i });
    await user.click(filterButton);
    
    expect(mockProps.onTogglePinnedFilter).toHaveBeenCalledTimes(1);
  });

  test('displays correct button text based on showOnlyPinned prop', () => {
    // When showOnlyPinned is false
    render(<ClassList {...mockProps} showOnlyPinned={false} />);
    expect(screen.getByText('Show Pinned Only')).toBeInTheDocument();
    
    // When showOnlyPinned is true
    render(<ClassList {...mockProps} showOnlyPinned={true} />);
    expect(screen.getByText('Show All Classes')).toBeInTheDocument();
  });

  test('calls onSelectClass when a class card is clicked', async () => {
    const user = userEvent.setup();
    render(<ClassList {...mockProps} />);
    
    await user.click(screen.getByTestId('class-card-1'));
    
    expect(mockProps.onSelectClass).toHaveBeenCalledTimes(1);
    expect(mockProps.onSelectClass).toHaveBeenCalledWith('1');
  });

  test('calls onRequestDelete when delete button is clicked', async () => {
    const user = userEvent.setup();
    render(<ClassList {...mockProps} />);
    
    await user.click(screen.getByTestId('delete-1'));
    
    expect(mockProps.onRequestDelete).toHaveBeenCalledTimes(1);
    expect(mockProps.onRequestDelete).toHaveBeenCalledWith('1');
  });

  test('applies correct styling to filter button based on showOnlyPinned', () => {
    // When showOnlyPinned is false
    render(<ClassList {...mockProps} showOnlyPinned={false} />);
    const inactiveButton = screen.getByRole('button', { name: /show pinned only/i });
    expect(inactiveButton).toHaveClass('bg-gray-700');
    expect(inactiveButton).not.toHaveClass('bg-green-500');
    
    // When showOnlyPinned is true
    render(<ClassList {...mockProps} showOnlyPinned={true} />);
    const activeButton = screen.getByRole('button', { name: /show all classes/i });
    expect(activeButton).toHaveClass('bg-green-500');
    expect(activeButton).not.toHaveClass('bg-gray-700');
  });
});
