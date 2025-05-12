import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import PDFList from '../../components/PDFList';
import type { PDF } from '../../utils/types';

// Mock the dnd-kit libraries
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <div data-testid="dnd-context">{children}</div>,
  closestCenter: vi.fn(),
  KeyboardSensor: vi.fn(),
  PointerSensor: vi.fn(),
  useSensor: vi.fn(),
  useSensors: vi.fn(() => 'sensors'),
}));

vi.mock('@dnd-kit/sortable', () => ({
  arrayMove: vi.fn((array, from, to) => {
    const result = [...array];
    const [removed] = result.splice(from, 1);
    result.splice(to, 0, removed);
    return result;
  }),
  SortableContext: ({ children }: { children: React.ReactNode }) => <div data-testid="sortable-context">{children}</div>,
  sortableKeyboardCoordinates: vi.fn(),
  verticalListSortingStrategy: 'vertical',
  useSortable: () => ({
    attributes: { 'aria-roledescription': 'sortable' },
    listeners: { 'data-testid': 'drag-handle' },
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: {
    Transform: {
      toString: vi.fn(() => null),
    },
  },
}));

// Mock the ConfirmationModal component
vi.mock('../../components/ConfirmationModal', () => ({
  default: vi.fn(({ isOpen, onConfirm, onCancel }) => (
    isOpen ? (
      <div data-testid="confirmation-modal">
        <button data-testid="confirm-delete" onClick={onConfirm}>Confirm Delete</button>
        <button data-testid="cancel-delete" onClick={onCancel}>Cancel Delete</button>
      </div>
    ) : null
  ))
}));

describe('PDFList Component', () => {
  const mockPDFs: PDF[] = [
    {
      id: 1,
      name: 'PDF 1.pdf',
      dateAdded: Date.now(),
      size: 1024 * 1024, // 1MB
      status: 'to-study',
      classId: '123',
      lastModified: Date.now(),
      data: new Uint8Array([1, 2, 3])
    },
    {
      id: 2,
      name: 'PDF 2.pdf',
      dateAdded: Date.now(),
      size: 2 * 1024 * 1024, // 2MB
      status: 'done',
      classId: '123',
      lastModified: Date.now(),
      data: new Uint8Array([4, 5, 6])
    }
  ];
  
  const mockProps = {
    pdfs: mockPDFs,
    listType: 'to-study' as const,
    onStatusChange: vi.fn(),
    onDelete: vi.fn(),
    onViewPDF: vi.fn(),
    onOrderChange: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders PDFs correctly', () => {
    render(<PDFList {...mockProps} />);
    
    expect(screen.getByText('PDF 1.pdf')).toBeInTheDocument();
    expect(screen.getByText('1 MB')).toBeInTheDocument();
  });

  test('renders empty state for to-study list', () => {
    render(
      <PDFList 
        {...mockProps} 
        pdfs={[]}
        listType="to-study"
      />
    );
    
    expect(screen.getByText('No PDFs Available')).toBeInTheDocument();
    expect(screen.getByText('No PDFs to study. Upload some to get started!')).toBeInTheDocument();
  });

  test('renders empty state for done list', () => {
    render(
      <PDFList 
        {...mockProps} 
        pdfs={[]}
        listType="done"
      />
    );
    
    expect(screen.getByText('No PDFs Available')).toBeInTheDocument();
    expect(screen.getByText("You haven't completed any PDFs yet. Keep up the great work!")).toBeInTheDocument();
  });

  test('calls onViewPDF when View button is clicked', async () => {
    const user = userEvent.setup();
    render(<PDFList {...mockProps} />);
    
    const viewButtons = screen.getAllByText('View');
    await user.click(viewButtons[0]);
    
    expect(mockProps.onViewPDF).toHaveBeenCalledWith(mockPDFs[0]);
  });

  test('calls onStatusChange when status button is clicked', async () => {
    const user = userEvent.setup();
    render(<PDFList {...mockProps} />);
    
    // Find the "Mark Done" button for the to-study PDF
    const markDoneButton = screen.getByText('Mark Done');
    await user.click(markDoneButton);
    
    expect(mockProps.onStatusChange).toHaveBeenCalledWith(1, 'done');
    
    // Find the "Study Again" button for the done PDF
    const studyAgainButton = screen.getByText('Study Again');
    await user.click(studyAgainButton);
    
    expect(mockProps.onStatusChange).toHaveBeenCalledWith(2, 'to-study');
  });

  test('shows confirmation modal when Delete button is clicked', async () => {
    const user = userEvent.setup();
    render(<PDFList {...mockProps} />);
    
    const deleteButtons = screen.getAllByText('Delete');
    await user.click(deleteButtons[0]);
    
    expect(screen.getByTestId('confirmation-modal')).toBeInTheDocument();
  });

  test('calls onDelete when deletion is confirmed', async () => {
    const user = userEvent.setup();
    render(<PDFList {...mockProps} />);
    
    // Request delete
    const deleteButtons = screen.getAllByText('Delete');
    await user.click(deleteButtons[0]);
    
    // Confirm delete
    await user.click(screen.getByTestId('confirm-delete'));
    
    expect(mockProps.onDelete).toHaveBeenCalledWith(1);
    
    // Modal should be closed
    expect(screen.queryByTestId('confirmation-modal')).not.toBeInTheDocument();
  });

  test('cancels deletion when cancel is clicked', async () => {
    const user = userEvent.setup();
    render(<PDFList {...mockProps} />);
    
    // Request delete
    const deleteButtons = screen.getAllByText('Delete');
    await user.click(deleteButtons[0]);
    
    // Cancel delete
    await user.click(screen.getByTestId('cancel-delete'));
    
    expect(mockProps.onDelete).not.toHaveBeenCalled();
    
    // Modal should be closed
    expect(screen.queryByTestId('confirmation-modal')).not.toBeInTheDocument();
  });

  test('formats file size correctly', () => {
    render(<PDFList {...mockProps} />);
    
    expect(screen.getByText('1 MB')).toBeInTheDocument();
    expect(screen.getByText('2 MB')).toBeInTheDocument();
  });

  test('formats date correctly', () => {
    render(<PDFList {...mockProps} />);
    
    // Check for date format (this is a loose check since the actual format depends on locale)
    expect(screen.getAllByText(/Added on/)).toHaveLength(2);
  });

  test('renders correct button text based on PDF status', () => {
    render(<PDFList {...mockProps} />);
    
    // The to-study PDF should have "Mark Done" button
    expect(screen.getByText('Mark Done')).toBeInTheDocument();
    
    // The done PDF should have "Study Again" button
    expect(screen.getByText('Study Again')).toBeInTheDocument();
  });
});
