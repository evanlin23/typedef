import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import ClassCreator from '../../components/ClassCreator';
import { addClass } from '../../utils/db';

// Mock the db utilities
vi.mock('../../utils/db', () => ({
  addClass: vi.fn().mockResolvedValue('new-class-id-123')
}));

describe('ClassCreator Component', () => {
  const mockProps = {
    onClassCreated: vi.fn().mockResolvedValue(undefined),
    onCreateClass: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders correctly', () => {
    render(<ClassCreator {...mockProps} />);
    
    expect(screen.getByText('Create New Class')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter class name (e.g., Math 101)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument();
  });

  test('updates input value when typing', async () => {
    const user = userEvent.setup();
    render(<ClassCreator {...mockProps} />);
    
    const input = screen.getByLabelText('New class name');
    await user.type(input, 'Physics 101');
    
    expect(input).toHaveValue('Physics 101');
  });

  test('disables button when input is empty', () => {
    render(<ClassCreator {...mockProps} />);
    
    const button = screen.getByRole('button', { name: 'Create' });
    expect(button).toBeDisabled();
  });

  test('enables button when input has text', async () => {
    const user = userEvent.setup();
    render(<ClassCreator {...mockProps} />);
    
    const input = screen.getByLabelText('New class name');
    await user.type(input, 'Physics 101');
    
    const button = screen.getByRole('button', { name: 'Create' });
    expect(button).not.toBeDisabled();
  });

  test('creates class when button is clicked', async () => {
    const user = userEvent.setup();
    render(<ClassCreator {...mockProps} />);
    
    // Type class name
    const input = screen.getByLabelText('New class name');
    await user.type(input, 'Physics 101');
    
    // Click create button
    const button = screen.getByRole('button', { name: 'Create' });
    await user.click(button);
    
    // Check if addClass was called with correct data
    expect(addClass).toHaveBeenCalledTimes(1);
    expect(addClass).toHaveBeenCalledWith({
      name: 'Physics 101',
      dateCreated: expect.any(Number),
      isPinned: false
    });
    
    // Check if callbacks were called
    expect(mockProps.onClassCreated).toHaveBeenCalledTimes(1);
    expect(mockProps.onCreateClass).toHaveBeenCalledTimes(1);
    expect(mockProps.onCreateClass).toHaveBeenCalledWith('new-class-id-123');
    
    // Input should be cleared
    expect(input).toHaveValue('');
  });

  test('creates class when Enter key is pressed', async () => {
    const user = userEvent.setup();
    render(<ClassCreator {...mockProps} />);
    
    // Type class name and press Enter
    const input = screen.getByLabelText('New class name');
    await user.type(input, 'Chemistry 202{Enter}');
    
    // Check if addClass was called
    expect(addClass).toHaveBeenCalledTimes(1);
    expect(mockProps.onClassCreated).toHaveBeenCalledTimes(1);
    expect(mockProps.onCreateClass).toHaveBeenCalledTimes(1);
  });

  test('shows "Creating..." text while creating class', async () => {
    // Mock addClass to delay resolution
    (addClass as jest.Mock).mockImplementationOnce(() => {
      return new Promise(resolve => setTimeout(() => resolve('new-class-id-123'), 100));
    });
    
    render(<ClassCreator {...mockProps} />);
    
    // Type class name
    const input = screen.getByLabelText('New class name');
    fireEvent.change(input, { target: { value: 'Biology 303' } });
    
    // Click create button
    const button = screen.getByRole('button', { name: 'Create' });
    fireEvent.click(button);
    
    // Button should show "Creating..." and be disabled
    expect(screen.getByRole('button', { name: 'Creating...' })).toBeInTheDocument();
    expect(button).toBeDisabled();
    
    // Wait for the operation to complete
    await screen.findByRole('button', { name: 'Create' });
  });

  test('does not create class with empty name', async () => {
    const user = userEvent.setup();
    render(<ClassCreator {...mockProps} />);
    
    // Type spaces only
    const input = screen.getByLabelText('New class name');
    await user.type(input, '   ');
    
    // Try to create by pressing Enter
    await user.keyboard('{Enter}');
    
    // addClass should not be called
    expect(addClass).not.toHaveBeenCalled();
  });

  test('handles errors during class creation', async () => {
    // Mock console.error to prevent test output pollution
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Mock addClass to reject
    (addClass as jest.Mock).mockRejectedValueOnce(new Error('Database error'));
    
    const user = userEvent.setup();
    render(<ClassCreator {...mockProps} />);
    
    // Type class name
    const input = screen.getByLabelText('New class name');
    await user.type(input, 'Error Class');
    
    // Click create button
    const button = screen.getByRole('button', { name: 'Create' });
    await user.click(button);
    
    // Check if error was logged
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to create class:', expect.any(Error));
    
    // Button should be enabled again after error
    expect(button).not.toBeDisabled();
    expect(button).toHaveTextContent('Create');
    
    // Restore console.error
    consoleErrorSpy.mockRestore();
  });
});
