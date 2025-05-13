// Original path: __tests__/components/PDFList.test.tsx
// src/__tests__/components/PDFList.test.tsx
import React, { type MutableRefObject } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import PDFList from '../../components/PDFList';
import type { PDF } from '../../utils/types';
import { useSortable as actualUseSortable } from '@dnd-kit/sortable';
import type { DraggableAttributes, DraggableSyntheticListeners, UniqueIdentifier, Over } from '@dnd-kit/core';
import type { SortableData } from '@dnd-kit/sortable';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const original = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...original,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <div data-testid="dnd-context">{children}</div>,
  closestCenter: vi.fn(),
  KeyboardSensor: vi.fn(),
  PointerSensor: vi.fn(),
  useSensor: vi.fn(),
  useSensors: vi.fn(() => 'sensors'), // Mock return value for useSensors
}));

// --- Define mockUseSortableReturnValue BEFORE its use in vi.mock ---
const mockUseSortableReturnValueDetails: ReturnType<typeof actualUseSortable> = { // Use ReturnType for better type inference
  active: null,
  activeIndex: -1,
  attributes: { 'aria-roledescription': 'sortable' } as DraggableAttributes,
  data: {} as SortableData & Record<string, unknown>,
  rect: { current: null } as MutableRefObject<ClientRect | null>,
  index: -1,
  isDragging: false,
  isSorting: false,
  isOver: false,
  // listeners should be DraggableSyntheticListeners or undefined.
  // The data-testid should be on the component's element itself.
  // For the mock, if you're not testing the listeners' functionality, undefined or {} is fine.
  listeners: undefined as DraggableSyntheticListeners | undefined,
  node: { current: null } as MutableRefObject<HTMLElement | null>,
  over: null as Over | null, // Correctly typed 'over'
  setNodeRef: vi.fn(),
  setActivatorNodeRef: vi.fn(),
  setDroppableNodeRef: vi.fn(),
  transform: null,
  transition: undefined,
  newIndex: -1,
  items: [] as UniqueIdentifier[],
  overIndex: -1,
  setDraggableNodeRef: vi.fn(),
};

vi.mock('@dnd-kit/sortable', async (importOriginal) => {
  const original = await importOriginal<typeof import('@dnd-kit/sortable')>();
  return {
    ...original,
    useSortable: vi.fn(() => mockUseSortableReturnValueDetails),
    arrayMove: vi.fn((array, from, to) => {
      const result = [...array];
      const [removed] = result.splice(from, 1);
      result.splice(to, 0, removed);
      return result;
    }),
    SortableContext: ({ children }: { children: React.ReactNode }) => <div data-testid="sortable-context">{children}</div>,
    sortableKeyboardCoordinates: vi.fn(),
    verticalListSortingStrategy: 'vertical',
  };
});

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: vi.fn(() => null) } },
}));

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

const renderWithRouter = (component: React.ReactElement) => {
  return render(<MemoryRouter>{component}</MemoryRouter>);
};


describe('PDFList Component', () => {
  const mockPDFs: PDF[] = [
    { id: 1, name: 'PDF 1.pdf', dateAdded: Date.now(), size: 1048576, status: 'to-study', classId: 'class-123', lastModified: Date.now(), data: new Uint8Array(), orderIndex: 0 },
    { id: 2, name: 'PDF 2.pdf', dateAdded: Date.now(), size: 2097152, status: 'done', classId: 'class-123', lastModified: Date.now(), data: new Uint8Array(), orderIndex: 1 }
  ];

  const getMockProps = () => ({
    pdfs: [...mockPDFs.map(p => ({...p}))],
    listType: 'to-study' as const,
    classId: 'class-123',
    onStatusChange: vi.fn(),
    onDelete: vi.fn(),
    onViewPDF: vi.fn(), 
    onOrderChange: vi.fn()
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(actualUseSortable).mockReturnValue(mockUseSortableReturnValueDetails);
  });

  test('renders PDFs correctly', () => {
    renderWithRouter(<PDFList {...getMockProps()} />);
    expect(screen.getByText('PDF 1.pdf')).toBeInTheDocument();
    expect(screen.getByText('PDF 2.pdf')).toBeInTheDocument();
    expect(screen.getByText('1 MB')).toBeInTheDocument();
  });

  test('calls navigate when View button is clicked inside SortablePDFItem', async () => {
    const user = userEvent.setup();
    renderWithRouter(<PDFList {...getMockProps()} />);
    const viewButton1 = screen.getByRole('button', { name: /View PDF 1\.pdf/i });
    await user.click(viewButton1);
    expect(mockNavigate).toHaveBeenCalledWith('/classes/class-123/pdf/1');

    mockNavigate.mockClear();
    const viewButton2 = screen.getByRole('button', { name: /View PDF 2\.pdf/i });
    await user.click(viewButton2);
    expect(mockNavigate).toHaveBeenCalledWith('/classes/class-123/pdf/2');
  });

  test('renders empty state for to-study list', () => {
    renderWithRouter(<PDFList {...getMockProps()} pdfs={[]} listType="to-study"/>);
    expect(screen.getByText('No PDFs to study. Upload some to get started!')).toBeInTheDocument();
  });

  test('renders empty state for done list', () => {
    renderWithRouter(<PDFList {...getMockProps()} pdfs={[]} listType="done"/>);
    expect(screen.getByText("You haven't completed any PDFs yet. Keep up the great work!")).toBeInTheDocument();
  });


  test('calls onStatusChange when status button is clicked', async () => {
    const props = getMockProps();
    const user = userEvent.setup();
    renderWithRouter(<PDFList {...props} />);
    const markDoneButton = screen.getByRole('button', { name: /Mark PDF 1\.pdf as done/i });
    await user.click(markDoneButton);
    expect(props.onStatusChange).toHaveBeenCalledWith(1, 'done');

    const studyAgainButton = screen.getByRole('button', { name: /Mark PDF 2\.pdf to study again/i });
    await user.click(studyAgainButton);
    expect(props.onStatusChange).toHaveBeenCalledWith(2, 'to-study');
  });

  test('shows confirmation modal when Delete button is clicked', async () => {
    const user = userEvent.setup();
    renderWithRouter(<PDFList {...getMockProps()} />);
    const deleteButton = screen.getByRole('button', { name: /Delete PDF 1\.pdf/i });
    await user.click(deleteButton);
    expect(screen.getByTestId('confirmation-modal')).toBeInTheDocument();
  });

  test('calls onDelete when deletion is confirmed', async () => {
    const props = getMockProps();
    const user = userEvent.setup();
    renderWithRouter(<PDFList {...props} />);
    const deleteButton = screen.getByRole('button', { name: /Delete PDF 1\.pdf/i });
    await user.click(deleteButton);
    await user.click(screen.getByTestId('confirm-delete'));
    expect(props.onDelete).toHaveBeenCalledWith(1);
    expect(screen.queryByTestId('confirmation-modal')).not.toBeInTheDocument();
  });

  test('cancels deletion when cancel is clicked', async () => {
    const props = getMockProps();
    const user = userEvent.setup();
    renderWithRouter(<PDFList {...props} />);
    const deleteButton = screen.getByRole('button', { name: /Delete PDF 1\.pdf/i });
    await user.click(deleteButton);
    await user.click(screen.getByTestId('cancel-delete'));
    expect(props.onDelete).not.toHaveBeenCalled();
    expect(screen.queryByTestId('confirmation-modal')).not.toBeInTheDocument();
  });

  test('formats file size correctly', () => {
    renderWithRouter(<PDFList {...getMockProps()} />);
    expect(screen.getByText('1 MB')).toBeInTheDocument();
    expect(screen.getByText('2 MB')).toBeInTheDocument();
  });

  test('formats date correctly', () => {
    renderWithRouter(<PDFList {...getMockProps()} />);
    expect(screen.getAllByText(/Added on/)).toHaveLength(2);
  });

  test('renders correct button text based on PDF status', () => {
    renderWithRouter(<PDFList {...getMockProps()} />);
    expect(screen.getByRole('button', { name: /Mark PDF 1\.pdf as done/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mark PDF 2\.pdf to study again/i })).toBeInTheDocument();
  });

  test('renders DndContext and SortableContext for draggable items', () => {
    // Ensure the SortablePDFItem (not shown here, but implied by useSortable)
    // renders a drag handle with data-testid="drag-handle-listener"
    // For example, if SortablePDFItem renders:
    // <button {...listeners} data-testid="drag-handle-listener">Drag</button>
    renderWithRouter(<PDFList {...getMockProps()} pdfs={mockPDFs.filter(p => p.id !== undefined)} />);
    expect(screen.getByTestId('dnd-context')).toBeInTheDocument();
    expect(screen.getByTestId('sortable-context')).toBeInTheDocument();
    
    // This assertion depends on your SortablePDFItem rendering elements with this test ID.
    // The mock listeners: undefined means useSortable itself doesn't add this testid.
    // Your SortablePDFItem component needs to add it.
    // If your SortablePDFItem's drag handle button has this test id, it will pass.
    const dragHandles = screen.queryAllByTestId('drag-handle-listener');
    // If each SortablePDFItem has one such handle:
    expect(dragHandles.length).toBe(mockPDFs.length); 
  });
});