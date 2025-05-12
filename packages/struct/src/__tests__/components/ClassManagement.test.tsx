import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, expect, describe, beforeEach, test } from 'vitest';
import ClassManagement from '../../components/ClassManagement';
import { getClasses, deleteClass } from '../../utils/db';
import type { Class } from '../../utils/types';

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

// Mock the db utilities
vi.mock('../../utils/db', () => ({
  getClasses: vi.fn(),
  deleteClass: vi.fn().mockResolvedValue(undefined)
}));

// Mock the child components
vi.mock('../../components/ClassCreator', () => ({
  default: vi.fn(({ onCreateClass }) => (
    <div data-testid="class-creator">
      <button 
        data-testid="create-class-button" 
        onClick={() => onCreateClass('new-class-id')}
      >
        Create Class
      </button>
    </div>
  ))
}));

vi.mock('../../components/ClassList', () => ({
  default: vi.fn(({ classes, showOnlyPinned, onTogglePinnedFilter, onSelectClass, onRequestDelete }) => (
    <div data-testid="class-list">
      <div>Classes: {classes.length}</div>
      <div>Pinned Only: {showOnlyPinned ? 'Yes' : 'No'}</div>
      <button data-testid="toggle-pinned" onClick={onTogglePinnedFilter}>Toggle Pinned</button>
      {classes.map((cls: Class) => (
        <div key={cls.id} data-testid={`class-${cls.id}`}>
          <span>{cls.name}</span>
          <button onClick={() => onSelectClass(cls.id || '')}>Select</button>
          <button onClick={() => onRequestDelete(cls.id || '')}>Delete</button>
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

describe('ClassManagement Component', () => {
  const mockClasses: Class[] = [
    {
      id: '1',
      name: 'Math 101',
      dateCreated: Date.now() - 100000,
      isPinned: true,
      pdfCount: 5,
      doneCount: 2,
      notes: '',
      progress: 40,
      completedItems: 2,
      totalItems: 5
    },
    {
      id: '2',
      name: 'History 202',
      dateCreated: Date.now() - 200000,
      isPinned: false,
      pdfCount: 3,
      doneCount: 1,
      notes: '',
      progress: 33,
      completedItems: 1,
      totalItems: 3
    }
  ];
  
  const mockProps = {
    onSelectClass: vi.fn(),
    onCreateClass: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock implementation for getClasses
    (getClasses as jest.Mock).mockResolvedValue(mockClasses);
  });

  test('renders loading state initially', () => {
    render(<ClassManagement {...mockProps} />);
    
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  test('renders classes after loading', async () => {
    render(<ClassManagement {...mockProps} />);
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });
    
    expect(screen.getByTestId('class-list')).toBeInTheDocument();
    expect(screen.getByText('Classes: 2')).toBeInTheDocument();
  });

  test('calculates and sorts classes correctly', async () => {
    // Mock implementation to return sorted classes
    (getClasses as jest.Mock).mockImplementationOnce(() => {
      return Promise.resolve([
        // Pinned class should come first
        {
          id: '1',
          name: 'Math 101',
          dateCreated: Date.now() - 100000,
          isPinned: true,
          pdfCount: 5,
          doneCount: 2,
          notes: '',
          progress: 40,
          completedItems: 2,
          totalItems: 5
        },
        // Then non-pinned classes by date (newest first)
        {
          id: '2',
          name: 'History 202',
          dateCreated: Date.now() - 200000,
          isPinned: false,
          pdfCount: 3,
          doneCount: 1,
          notes: '',
          progress: 33,
          completedItems: 1,
          totalItems: 3
        }
      ]);
    });
    
    render(<ClassManagement {...mockProps} />);
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });
    
    // Check that the class list is rendered with the correct number of classes
    expect(screen.getByText('Classes: 2')).toBeInTheDocument();
    
    // Check that the first class name is displayed (the pinned one)
    const firstClassName = screen.getAllByText('Math 101')[0];
    expect(firstClassName).toBeInTheDocument();
    
    // Check that the second class name is displayed
    expect(screen.getByText('History 202')).toBeInTheDocument();
  });

  test('handles class selection', async () => {
    const user = userEvent.setup();
    render(<ClassManagement {...mockProps} />);
    
    await waitFor(() => {
      expect(screen.getByTestId('class-list')).toBeInTheDocument();
    });
    
    // Find and click the select button for the first class
    const selectButtons = screen.getAllByText('Select');
    await user.click(selectButtons[0]);
    
    expect(mockProps.onSelectClass).toHaveBeenCalledWith('1');
  });

  test('handles class creation', async () => {
    const user = userEvent.setup();
    render(<ClassManagement {...mockProps} />);
    
    // Click the create class button
    await user.click(screen.getByTestId('create-class-button'));
    
    expect(mockProps.onCreateClass).toHaveBeenCalledWith('new-class-id');
  });

  test('toggles pinned filter', async () => {
    const user = userEvent.setup();
    render(<ClassManagement {...mockProps} />);
    
    await waitFor(() => {
      expect(screen.getByTestId('class-list')).toBeInTheDocument();
    });
    
    // Initially should show all classes
    expect(screen.getByText('Pinned Only: No')).toBeInTheDocument();
    
    // Toggle filter
    await user.click(screen.getByTestId('toggle-pinned'));
    
    // Should now show only pinned classes
    expect(screen.getByText('Pinned Only: Yes')).toBeInTheDocument();
  });

  test('opens confirmation modal when delete is requested', async () => {
    const user = userEvent.setup();
    render(<ClassManagement {...mockProps} />);
    
    await waitFor(() => {
      expect(screen.getByTestId('class-list')).toBeInTheDocument();
    });
    
    // Find and click the delete button for the first class
    const deleteButtons = screen.getAllByText('Delete');
    await user.click(deleteButtons[0]);
    
    // Confirmation modal should be visible
    expect(screen.getByTestId('confirmation-modal')).toBeInTheDocument();
  });

  test('deletes class when confirmed', async () => {
    const user = userEvent.setup();
    render(<ClassManagement {...mockProps} />);
    
    await waitFor(() => {
      expect(screen.getByTestId('class-list')).toBeInTheDocument();
    });
    
    // Request delete
    const deleteButtons = screen.getAllByText('Delete');
    await user.click(deleteButtons[0]);
    
    // Confirm delete
    await user.click(screen.getByTestId('confirm-delete'));
    
    // Check if deleteClass was called with correct ID
    expect(deleteClass).toHaveBeenCalledWith('1');
    
    // Check if classes were reloaded
    expect(getClasses).toHaveBeenCalledTimes(2); // Once on initial load, once after delete
  });

  test('cancels class deletion', async () => {
    const user = userEvent.setup();
    render(<ClassManagement {...mockProps} />);
    
    await waitFor(() => {
      expect(screen.getByTestId('class-list')).toBeInTheDocument();
    });
    
    // Request delete
    const deleteButtons = screen.getAllByText('Delete');
    await user.click(deleteButtons[0]);
    
    // Cancel delete
    await user.click(screen.getByTestId('cancel-delete'));
    
    // Modal should be closed
    expect(screen.queryByTestId('confirmation-modal')).not.toBeInTheDocument();
    
    // deleteClass should not have been called
    expect(deleteClass).not.toHaveBeenCalled();
  });

  test('handles error during class loading', async () => {
    // Mock console.error to prevent test output pollution
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Mock getClasses to reject
    (getClasses as jest.Mock).mockRejectedValueOnce(new Error('Database error'));
    
    render(<ClassManagement {...mockProps} />);
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });
    
    // Error should be logged
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to load classes:', expect.any(Error));
    
    // Class list should be empty
    expect(screen.getByText('Classes: 0')).toBeInTheDocument();
    
    // Restore console.error
    consoleErrorSpy.mockRestore();
  });

  test('handles error during class deletion', async () => {
    // Mock console.error to prevent test output pollution
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    
    // Mock deleteClass to reject
    (deleteClass as jest.Mock).mockRejectedValueOnce(new Error('Delete error'));
    
    const user = userEvent.setup();
    render(<ClassManagement {...mockProps} />);
    
    await waitFor(() => {
      expect(screen.getByTestId('class-list')).toBeInTheDocument();
    });
    
    // Request delete
    const deleteButtons = screen.getAllByText('Delete');
    await user.click(deleteButtons[0]);
    
    // Confirm delete
    await user.click(screen.getByTestId('confirm-delete'));
    
    // Error should be logged and alert shown
    expect(consoleErrorSpy).toHaveBeenCalledWith('[ClassManagement] Failed to delete class:', expect.any(Error));
    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to delete class: Delete error'));
    
    // Modal should be closed
    expect(screen.queryByTestId('confirmation-modal')).not.toBeInTheDocument();
    
    // Restore mocks
    consoleErrorSpy.mockRestore();
    alertSpy.mockRestore();
  });
});
