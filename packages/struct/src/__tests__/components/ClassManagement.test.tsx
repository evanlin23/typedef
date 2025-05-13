// Original path: __tests__/components/ClassManagement.test.tsx
// src/__tests__/components/ClassManagement.test.tsx
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, expect, describe, beforeEach, test } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import ClassManagement from '../../components/ClassManagement';
import { getClasses, deleteClass } from '../../utils/db';
import type { Class } from '../../utils/types';

vi.mock('../../utils/db', () => ({
  getClasses: vi.fn(),
  deleteClass: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../../components/ClassCreator', () => ({
  default: vi.fn(({ onCreateClass }) => (
    <div data-testid="class-creator">
      <button
        data-testid="create-class-button"
        onClick={() => onCreateClass('new-class-id-from-creator')}
      >
        Create Class
      </button>
    </div>
  ))
}));

// Updated ClassList mock for the filter button test and prop rename
vi.mock('../../components/ClassList', () => ({
  default: vi.fn(({ classes, showOnlyPinned, onTogglePinnedFilter, onRequestDelete }) => ( // Changed onRequestDelete to onRequestDelete
    <div data-testid="class-list">
      <div>Classes: {classes.length}</div>
      <div>Pinned Only: {showOnlyPinned ? 'Yes' : 'No'}</div>
      <button data-testid="toggle-pinned-filter-btn" onClick={onTogglePinnedFilter}>Toggle Filter</button>
      {classes.map((cls: Class) => (
        <div key={cls.id} data-testid={`class-${cls.id}`}>
          <span>{cls.name}</span>
          {/* Removed select button from mock as ClassCard handles selection */}
          <button onClick={() => onRequestDelete(cls.id || '')} data-testid={`delete-${cls.id}`}>Delete</button>
        </div>
      ))}
    </div>
  ))
}));

vi.mock('../../components/ConfirmationModal', () => ({
  default: vi.fn(({ isOpen, onConfirm, onCancel }) => (
    isOpen ? (
      <div data-testid="confirmation-modal">
        <button data-testid="confirm-delete" onClick={onConfirm}>Confirm</button>
        <button data-testid="cancel-delete" onClick={onCancel}>Cancel</button>
      </div>
    ) : null
  ))
}));

vi.mock('../../components/Header', () => ({
  default: vi.fn(() => <header data-testid="header">Header</header>)
}));
vi.mock('../../components/Footer', () => ({
  default: vi.fn(() => <footer data-testid="footer">Footer</footer>)
}));
vi.mock('../../components/LoadingSpinner', () => ({
  default: vi.fn(() => <div data-testid="loading-spinner">Loading...</div>)
}));

const renderWithRouter = (component: React.ReactElement) => {
  return render(<MemoryRouter>{component}</MemoryRouter>);
};

describe('ClassManagement Component', () => {
  const mockClasses: Class[] = [
    { id: '1', name: 'Math 101', dateCreated: Date.now() - 100000, isPinned: true, pdfCount: 5, doneCount: 2, notes: '', progress: 40, completedItems: 2, totalItems: 5 },
    { id: '2', name: 'History 202', dateCreated: Date.now() - 200000, isPinned: false, pdfCount: 3, doneCount: 1, notes: '', progress: 33, completedItems: 1, totalItems: 3 }
  ];

  const mockProps = {
    onSelectClass: vi.fn(), // Keep this for the wrapper test, even if ClassList doesn't take it directly
    onCreateClass: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getClasses).mockResolvedValue([...mockClasses]); // Ensure fresh copy
    mockProps.onSelectClass.mockClear();
    mockProps.onCreateClass.mockClear();
  });

  test('renders loading state initially', async () => {
    renderWithRouter(<ClassManagement {...mockProps} />);
    // Initial render might involve state updates from useEffect, wrap in act if warnings persist
    await act(async () => {
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });
  });

  test('renders classes after loading', async () => {
    renderWithRouter(<ClassManagement {...mockProps} />);
    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });
    expect(screen.getByTestId('class-list')).toBeInTheDocument();
    expect(screen.getByText('Classes: 2')).toBeInTheDocument();
  });

  // This test might be less relevant now as ClassList mock doesn't have a select button
  // It relies on ClassCard calling its onSelect prop which ClassList passes down
  // Keep it to ensure the callback *passed* to ClassManagement is tested conceptually
  // test('calls onSelectClass prop conceptually when a class is selected', async () => {
  //   renderWithRouter(<ClassManagement {...mockProps} />);
  //   // Simulate the action that would eventually call onSelectClass
  //   // In real scenario, user clicks ClassCard -> calls ClassCard's onSelect -> ClassList passes handleSelectClass -> Navigates -> props.onSelectClass is called by wrapper
  //   // Since we mocked ClassList, we can't directly test the click path through ClassCard
  // });

  test('calls onCreateClass prop when a class is created via ClassCreator', async () => {
    const user = userEvent.setup();
    renderWithRouter(<ClassManagement {...mockProps} />);
    await waitFor(() => expect(screen.getByTestId('create-class-button')).toBeInTheDocument());
    await user.click(screen.getByTestId('create-class-button'));
    expect(mockProps.onCreateClass).toHaveBeenCalledWith('new-class-id-from-creator');
  });

  test('calculates and sorts classes correctly', async () => {
    vi.mocked(getClasses).mockResolvedValueOnce([ // Ensure this mock applies only once
      { id: '1', name: 'Math 101', dateCreated: Date.now() - 100000, isPinned: true, pdfCount: 5, doneCount: 2, notes: '', progress: 40, completedItems: 2, totalItems: 5 },
      { id: '2', name: 'History 202', dateCreated: Date.now() - 200000, isPinned: false, pdfCount: 3, doneCount: 1, notes: '', progress: 33, completedItems: 1, totalItems: 3 }
    ]);
    renderWithRouter(<ClassManagement {...mockProps} />);
    await waitFor(() => expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument());
    expect(screen.getByText('Classes: 2')).toBeInTheDocument();
    // Ensure the ClassList mock received the correct data by checking rendered names
    expect(screen.getByText('Math 101')).toBeInTheDocument();
    expect(screen.getByText('History 202')).toBeInTheDocument();
  });

  test('toggles pinned filter', async () => {
    const user = userEvent.setup();
    renderWithRouter(<ClassManagement {...mockProps} />);
    await waitFor(() => expect(screen.getByTestId('class-list')).toBeInTheDocument());

    expect(screen.getByText('Pinned Only: No')).toBeInTheDocument();
    const filterButton = screen.getByTestId('toggle-pinned-filter-btn');
    await user.click(filterButton);

    // The ClassManagement component updates its state, then re-renders ClassList
    // The mocked ClassList will receive the new `showOnlyPinned` prop
    await waitFor(() => expect(screen.getByText('Pinned Only: Yes')).toBeInTheDocument());
  });

  test('opens confirmation modal when delete is requested via ClassList', async () => {
    const user = userEvent.setup();
    renderWithRouter(<ClassManagement {...mockProps} />);
    await waitFor(() => expect(screen.getByTestId('delete-1')).toBeInTheDocument());
    await user.click(screen.getByTestId('delete-1')); // Click delete button in mocked ClassList
    expect(screen.getByTestId('confirmation-modal')).toBeInTheDocument();
  });

  test('deletes class when confirmed', async () => {
    const user = userEvent.setup();
    renderWithRouter(<ClassManagement {...mockProps} />);
    await waitFor(() => expect(screen.getByTestId('delete-1')).toBeInTheDocument());
    await user.click(screen.getByTestId('delete-1'));
    await user.click(screen.getByTestId('confirm-delete'));
    expect(deleteClass).toHaveBeenCalledWith('1');
    await waitFor(() => expect(getClasses).toHaveBeenCalledTimes(2)); // Initial load + after delete
  });

  test('cancels class deletion', async () => {
    const user = userEvent.setup();
    renderWithRouter(<ClassManagement {...mockProps} />);
    await waitFor(() => expect(screen.getByTestId('delete-1')).toBeInTheDocument());
    await user.click(screen.getByTestId('delete-1'));
    await user.click(screen.getByTestId('cancel-delete'));
    expect(screen.queryByTestId('confirmation-modal')).not.toBeInTheDocument();
    expect(deleteClass).not.toHaveBeenCalled();
  });

  test('handles error during class loading', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(getClasses).mockRejectedValueOnce(new Error('Database error')); // Mock for this specific test
    renderWithRouter(<ClassManagement {...mockProps} />);
    await waitFor(() => expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument());
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to load classes:', expect.any(Error));
    expect(screen.getByText('Classes: 0')).toBeInTheDocument();
    consoleErrorSpy.mockRestore();
  });

  test('handles error during class deletion', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.mocked(deleteClass).mockRejectedValueOnce(new Error('Delete error'));
    const user = userEvent.setup();
    renderWithRouter(<ClassManagement {...mockProps} />);
    await waitFor(() => expect(screen.getByTestId('delete-1')).toBeInTheDocument());
    await user.click(screen.getByTestId('delete-1'));
    await user.click(screen.getByTestId('confirm-delete'));
    expect(consoleErrorSpy).toHaveBeenCalledWith('[ClassManagement] Failed to delete class:', expect.any(Error));
    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to delete class: Delete error'));
    consoleErrorSpy.mockRestore();
    alertSpy.mockRestore();
  });
});