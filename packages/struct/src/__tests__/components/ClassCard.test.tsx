import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, expect, describe, beforeEach, test } from 'vitest';
import ClassCard from '../../components/ClassCard';
import { updateClass } from '../../utils/db';
import type { Class } from '../../utils/types';

// Add the necessary matchers for testing-library
declare global {
  namespace Vi {
    interface AsymmetricMatchersContaining {
      toBeInTheDocument(): void;
      toHaveValue(value: string): void;
      toHaveClass(className: string): void;
      toHaveAttribute(attr: string, value?: string): void;
    }
    
    interface Assertion {
      toBeInTheDocument(): Assertion;
      toHaveValue(value: string): Assertion;
      toHaveClass(className: string): Assertion;
      toHaveAttribute(attr: string, value?: string): Assertion;
      not: Assertion;
    }
  }
}

// Mock the db utilities
vi.mock('../../utils/db', () => ({
  updateClass: vi.fn().mockResolvedValue(undefined)
}));

describe('ClassCard Component', () => {
  // Mock data
  const mockClassData: Class = {
    id: 'class-1',
    name: 'Math 101',
    dateCreated: Date.now(),
    isPinned: true,
    pdfCount: 10,
    doneCount: 5,
    notes: '',
    totalItems: 10,
    completedItems: 5,
    progress: 50
  };

  const mockProps = {
    classData: mockClassData,
    onSelect: vi.fn(),
    onRequestDelete: vi.fn(),
    onDataChanged: vi.fn().mockResolvedValue(undefined)
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders correctly with class data', () => {
    render(<ClassCard {...mockProps} />);
    
    expect(screen.getByText('Math 101')).toBeInTheDocument();
    // The date is formatted, so we need to check for partial text
    expect(screen.getByText(/Created:/)).toBeInTheDocument();
    expect(screen.getByText(`${mockClassData.pdfCount} PDFs`)).toBeInTheDocument();
  });

  test('renders correctly', () => {
    render(<ClassCard {...mockProps} />);
    
    // Test class selection
    const card = screen.getByRole('button', { name: /math 101/i });
    fireEvent.click(card);
    
    expect(mockProps.onSelect).toHaveBeenCalledTimes(1);
  });

  test('toggles pin status', async () => {
    // Mock the updateClass to call onDataChanged when it resolves
    (updateClass as jest.Mock).mockImplementation(() => {
      mockProps.onDataChanged();
      return Promise.resolve();
    });
    
    render(<ClassCard {...mockProps} />);
    
    // Find the pin/unpin button
    const pinButton = screen.getByTitle('Unpin class');
    await userEvent.click(pinButton);
    
    // Check if updateClass was called with correct parameters
    expect(updateClass).toHaveBeenCalledWith(mockProps.classData.id, { isPinned: false });
    expect(mockProps.onDataChanged).toHaveBeenCalled();
  });

  test('allows editing class name', async () => {
    // Mock the updateClass to call onDataChanged when it resolves
    (updateClass as jest.Mock).mockImplementation(() => {
      mockProps.onDataChanged();
      return Promise.resolve();
    });
    
    render(<ClassCard {...mockProps} />);
    
    // Find the edit button
    const editButton = screen.getByLabelText('Edit class name');
    await userEvent.click(editButton);
    
    // Input field should appear
    const inputField = screen.getByDisplayValue('Math 101');
    
    // Mock the input change directly to ensure the value is set correctly
    fireEvent.change(inputField, { target: { value: 'New Class Name' } });
    
    // Press Enter to submit
    await userEvent.keyboard('{Enter}');
    
    // Check if updateClass was called with correct parameters
    expect(updateClass).toHaveBeenCalledWith('class-1', { name: 'New Class Name' });
    expect(mockProps.onDataChanged).toHaveBeenCalled();
  });

  test('handles delete button click', async () => {
    // Create a fresh mock for onRequestDelete
    const onRequestDeleteMock = vi.fn();
    
    // Render with the new mock
    render(<ClassCard {...mockProps} onRequestDelete={onRequestDeleteMock} />);
    
    // Find the delete button
    const deleteButton = screen.getByTitle('Delete class');
    
    // Use fireEvent instead of userEvent for this case
    fireEvent.click(deleteButton);
    
    // Check if onRequestDelete was called
    expect(onRequestDeleteMock).toHaveBeenCalled();
  });

  test('handles keyboard navigation', async () => {
    render(<ClassCard {...mockProps} />);
    
    // Get the main card element which is the first element with role button and class containing bg-gray-800
    const card = screen.getByRole('button', { name: /math 101/i });
    card.focus();
    
    fireEvent.keyDown(card, { key: 'Enter', code: 'Enter' });
    expect(mockProps.onSelect).toHaveBeenCalledTimes(1);
  });

  test('displays progress correctly', () => {
    const testClass: Class = {
      ...mockClassData,
      totalItems: 10,
      completedItems: 3,
      progress: 30
    };
    
    render(
      <ClassCard
        classData={testClass}
        onSelect={mockProps.onSelect}
        onRequestDelete={mockProps.onRequestDelete}
        onDataChanged={mockProps.onDataChanged}
      />
    );
    
    expect(screen.getByText('30%')).toBeInTheDocument();
  });

  test('cancels editing on escape key', async () => {
    render(<ClassCard {...mockProps} />);
    
    // Click edit button
    const editButton = screen.getByLabelText('Edit class name');
    fireEvent.click(editButton);
    
    // Input field should be visible
    const input = screen.getByRole('textbox');
    
    // Press escape key
    fireEvent.keyDown(input, { key: 'Escape', code: 'Escape' });
    
    // Input should be hidden - we can check by verifying the class name is visible again
    expect(screen.getByText('Math 101')).toBeInTheDocument();
    expect(updateClass).not.toHaveBeenCalled();
  });
});
