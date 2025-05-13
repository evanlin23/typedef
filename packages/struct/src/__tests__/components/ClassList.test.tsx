// src/__tests__/components/ClassList.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import ClassList from '../../components/ClassList';
import ClassCard from '../../components/ClassCard'; // Import the component for vi.mocked
import type { Class } from '../../utils/types';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const original = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...original,
    useNavigate: () => mockNavigate,
  };
});

// ClassCard mock reflects that its `onRequestDelete` prop is now called with no arguments
vi.mock('../../components/ClassCard', () => ({
  default: vi.fn(({ classData, onSelect, onRequestDelete }) => (
    <div
      data-testid={`class-card-${classData.id}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      aria-label={`Select class ${classData.name}`}
    >
      <div>{classData.name}</div>
      <button
        data-testid={`delete-${classData.id}`}
        onClick={() => {
          // ClassCard's internal button click.
          // It would call e.stopPropagation() itself.
          // Then it calls its onRequestDelete prop.
          onRequestDelete(); // Call the prop ClassList passed.
        }}
      >
        Delete
      </button>
    </div>
  ))
}));

vi.mock('../../components/EmptyClassList', () => ({
  default: vi.fn(() => <div data-testid="empty-list">No classes found</div>)
}));

const renderWithRouter = (component: React.ReactElement) => {
  return render(<MemoryRouter>{component}</MemoryRouter>);
};

describe('ClassList Component', () => {
  const mockClasses: Class[] = [
    { id: '1', name: 'Math 101', dateCreated: Date.now(), isPinned: true, totalItems: 5, completedItems: 2, progress: 40, pdfCount: 3, notes: 'Math class notes' },
    { id: '2', name: 'History 202', dateCreated: Date.now() - 86400000, isPinned: false, totalItems: 3, completedItems: 1, progress: 33, pdfCount: 2, notes: 'History class notes' }
  ];

  const mockProps = {
    classes: mockClasses,
    showOnlyPinned: false,
    onTogglePinnedFilter: vi.fn(),
    onRequestDelete: vi.fn(), // This is the main prop of ClassList: (classId: string) => void
    onDataChanged: vi.fn().mockResolvedValue(undefined)
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders correctly with classes', () => {
    renderWithRouter(<ClassList {...mockProps} />);
    expect(screen.getByText('Your Classes')).toBeInTheDocument();
    expect(screen.getByText('Show Pinned Only')).toBeInTheDocument();
    expect(screen.getByTestId('class-card-1')).toBeInTheDocument();
    expect(screen.getByTestId('class-card-2')).toBeInTheDocument();
  });

  test('renders EmptyClassList when no classes are provided', () => {
    renderWithRouter(<ClassList {...mockProps} classes={[]} />);
    expect(screen.getByTestId('empty-list')).toBeInTheDocument();
  });

  test('toggles pinned filter when button is clicked', async () => {
    const user = userEvent.setup();
    renderWithRouter(<ClassList {...mockProps} />);
    const filterButton = screen.getByRole('button', { name: /show pinned only/i });
    await user.click(filterButton);
    expect(mockProps.onTogglePinnedFilter).toHaveBeenCalledTimes(1);
  });

  test('displays correct button text based on showOnlyPinned prop', () => {
    renderWithRouter(<ClassList {...mockProps} showOnlyPinned={false} />);
    expect(screen.getByText('Show Pinned Only')).toBeInTheDocument();
    vi.mocked(ClassCard).mockClear(); // Use the imported ClassCard
    renderWithRouter(<ClassList {...mockProps} showOnlyPinned={true} />);
    expect(screen.getByText('Show All Classes')).toBeInTheDocument();
  });

  test('calls navigate when a class card is clicked', async () => {
    const user = userEvent.setup();
    renderWithRouter(<ClassList {...mockProps} />);
    await user.click(screen.getByTestId('class-card-1'));
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('/classes/1');
  });

  test('calls onRequestDelete prop of ClassList when delete button is clicked', async () => {
    const user = userEvent.setup();
    renderWithRouter(<ClassList {...mockProps} />);
    // The ClassCard mock calls its onRequestDelete prop.
    // ClassList's map provides `() => { if (cls.id) onRequestDelete(cls.id); }` to ClassCard's prop.
    // So, mockProps.onRequestDelete (the prop of ClassList) should be called with the ID.
    await user.click(screen.getByTestId('delete-1'));
    expect(mockProps.onRequestDelete).toHaveBeenCalledTimes(1);
    expect(mockProps.onRequestDelete).toHaveBeenCalledWith('1');
  });

  test('applies correct styling to filter button based on showOnlyPinned', () => {
    renderWithRouter(<ClassList {...mockProps} showOnlyPinned={false} />);
    const inactiveButton = screen.getByRole('button', { name: /show pinned only/i });
    expect(inactiveButton).toHaveClass('bg-gray-700');
    vi.mocked(ClassCard).mockClear(); // Use the imported ClassCard
    renderWithRouter(<ClassList {...mockProps} showOnlyPinned={true} />);
    const activeButton = screen.getByRole('button', { name: /show all classes/i });
    expect(activeButton).toHaveClass('bg-green-500');
  });
});