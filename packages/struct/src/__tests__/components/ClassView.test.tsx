import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, expect } from 'vitest';
import ClassView from '../../components/ClassView';
import type { PDF, Class } from '../../utils/types';
import type { TabType } from '../../components/TabNavigation';

// Mock the child components
vi.mock('../../components/FileUpload', () => ({
  default: vi.fn(({ onUpload }) => (
    <div data-testid="file-upload" onClick={() => {
      // Create a mock file list
      const mockFileList: FileList = {
        length: 1,
        item: () => new File(['test'], 'test.pdf', { type: 'application/pdf' }),
        0: new File(['test'], 'test.pdf', { type: 'application/pdf' }),
        [Symbol.iterator]: function() {
          let index = 0;
          return {
            next: () => {
              return index < this.length ? { value: this[index++], done: false } : { done: true, value: undefined };
            },
            [Symbol.iterator]: function() { return this; }
          };
        }
      };
      onUpload(mockFileList as FileList);
    }}>
      File Upload
    </div>
  ))
}));

vi.mock('../../components/ProgressStats', () => ({
  default: vi.fn(({ stats }) => (
    <div data-testid="progress-stats">
      Total: {stats.total}, To Study: {stats.toStudy}, Done: {stats.done}
    </div>
  ))
}));

vi.mock('../../components/PDFList', () => ({
  default: vi.fn(({ pdfs, listType, onStatusChange, onDelete, onViewPDF }) => (
    <div data-testid="pdf-list" data-list-type={listType}>
      {pdfs.map((pdf: PDF) => (
        <div key={pdf.id} data-testid={`pdf-item-${pdf.id}`}>
          <span>{pdf.name}</span>
          <button 
            onClick={() => onStatusChange(pdf.id, pdf.status === 'to-study' ? 'done' : 'to-study')}
            data-testid={`status-button-${pdf.id}`}
          >
            Toggle Status
          </button>
          <button 
            onClick={() => onDelete(pdf.id)}
            data-testid={`delete-button-${pdf.id}`}
          >
            Delete
          </button>
          <button 
            onClick={() => onViewPDF(pdf)}
            data-testid={`view-button-${pdf.id}`}
          >
            View
          </button>
        </div>
      ))}
    </div>
  ))
}));

vi.mock('../../components/LoadingSpinner', () => ({
  default: vi.fn(() => <div data-testid="loading-spinner">Loading...</div>)
}));

vi.mock('../../components/TabNavigation', () => ({
  default: vi.fn(({ activeTab, onTabChange, toStudyCount, doneCount }) => (
    <div data-testid="tab-navigation">
      <button 
        data-testid="tab-to-study" 
        onClick={() => onTabChange('to-study')}
        data-active={activeTab === 'to-study'}
      >
        To Study ({toStudyCount})
      </button>
      <button 
        data-testid="tab-done" 
        onClick={() => onTabChange('done')}
        data-active={activeTab === 'done'}
      >
        Done ({doneCount})
      </button>
      <button 
        data-testid="tab-notes" 
        onClick={() => onTabChange('notes')}
        data-active={activeTab === 'notes'}
      >
        Notes
      </button>
    </div>
  ))
}));

describe('ClassView Component', () => {
  const mockClass: Class = {
    id: 'class-1',
    name: 'Test Class',
    dateCreated: Date.now(),
    isPinned: false,
    pdfCount: 3,
    doneCount: 1,
    notes: 'Test notes'
  };

  const mockPDFs: PDF[] = [
    {
      id: 1,
      name: 'PDF 1.pdf',
      dateAdded: Date.now(),
      size: 1024,
      status: 'to-study',
      classId: 'class-1',
      data: new Uint8Array([1, 2, 3]),
      lastModified: Date.now()
    },
    {
      id: 2,
      name: 'PDF 2.pdf',
      dateAdded: Date.now(),
      size: 2048,
      status: 'to-study',
      classId: 'class-1',
      data: new Uint8Array([4, 5, 6]),
      lastModified: Date.now()
    },
    {
      id: 3,
      name: 'PDF 3.pdf',
      dateAdded: Date.now(),
      size: 3072,
      status: 'done',
      classId: 'class-1',
      data: new Uint8Array([7, 8, 9]),
      lastModified: Date.now()
    }
  ];

  const mockProps = {
    selectedClass: mockClass,
    pdfs: mockPDFs,
    activeTab: 'to-study' as TabType,
    isProcessing: false,
    onTabChange: vi.fn(),
    onFileUpload: vi.fn().mockResolvedValue(undefined),
    onStatusChange: vi.fn().mockResolvedValue(undefined),
    onDeletePDF: vi.fn().mockResolvedValue(undefined),
    onViewPDF: vi.fn(),
    onPDFOrderChange: vi.fn().mockResolvedValue(undefined),
    onNotesChange: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders correctly with to-study tab active', () => {
    render(<ClassView {...mockProps} />);
    
    // Check if FileUpload and ProgressStats are rendered
    expect(screen.getByTestId('file-upload')).toBeInTheDocument();
    expect(screen.getByTestId('progress-stats')).toBeInTheDocument();
    expect(screen.getByText('Total: 3, To Study: 2, Done: 1')).toBeInTheDocument();
    
    // Check if TabNavigation is rendered
    expect(screen.getByTestId('tab-navigation')).toBeInTheDocument();
    
    // Check if PDFList is rendered with to-study PDFs
    expect(screen.getByTestId('pdf-list')).toBeInTheDocument();
    expect(screen.getByTestId('pdf-list')).toHaveAttribute('data-list-type', 'to-study');
    
    // Should show 2 PDFs in the to-study tab
    expect(screen.getByTestId('pdf-item-1')).toBeInTheDocument();
    expect(screen.getByTestId('pdf-item-2')).toBeInTheDocument();
    expect(screen.queryByTestId('pdf-item-3')).not.toBeInTheDocument();
  });

  test('renders correctly with done tab active', () => {
    render(<ClassView {...mockProps} activeTab="done" />);
    
    // Check if PDFList is rendered with done PDFs
    expect(screen.getByTestId('pdf-list')).toHaveAttribute('data-list-type', 'done');
    
    // Should show 1 PDF in the done tab
    expect(screen.queryByTestId('pdf-item-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pdf-item-2')).not.toBeInTheDocument();
    expect(screen.getByTestId('pdf-item-3')).toBeInTheDocument();
  });

  test('renders correctly with notes tab active', () => {
    render(<ClassView {...mockProps} activeTab="notes" />);
    
    // Check if notes textarea is rendered
    const notesTextarea = screen.getByLabelText('Class notes editor');
    expect(notesTextarea).toBeInTheDocument();
    expect(notesTextarea).toHaveValue('Test notes');
  });

  test('handles tab change correctly', async () => {
    const user = userEvent.setup();
    render(<ClassView {...mockProps} />);
    
    // Click on the done tab
    await user.click(screen.getByTestId('tab-done'));
    
    // Check if onTabChange was called with 'done'
    expect(mockProps.onTabChange).toHaveBeenCalledWith('done');
    
    // Click on the notes tab
    await user.click(screen.getByTestId('tab-notes'));
    
    // Check if onTabChange was called with 'notes'
    expect(mockProps.onTabChange).toHaveBeenCalledWith('notes');
  });

  test('handles notes change correctly', async () => {
    const user = userEvent.setup();
    render(<ClassView {...mockProps} activeTab="notes" />);
    
    // Get the notes textarea
    const notesTextarea = screen.getByLabelText('Class notes editor');
    
    // Type in the textarea
    await user.clear(notesTextarea);
    
    // Reset the mock to clear previous calls
    mockProps.onNotesChange.mockClear();
    
    // Type a single character to test the onChange handler
    await user.type(notesTextarea, 'X');
    
    // Check if onNotesChange was called at least once
    expect(mockProps.onNotesChange).toHaveBeenCalled();
  });

  test('handles file upload correctly', async () => {
    // Clear previous mock calls
    mockProps.onFileUpload.mockClear();
    
    const user = userEvent.setup();
    render(<ClassView {...mockProps} />);
    
    // Click on the file upload component
    await user.click(screen.getByTestId('file-upload'));
    
    // Check if onFileUpload was called
    expect(mockProps.onFileUpload).toHaveBeenCalled();
  });

  test('handles PDF status change correctly', async () => {
    const user = userEvent.setup();
    render(<ClassView {...mockProps} />);
    
    // Click on the status toggle button for PDF 1
    await user.click(screen.getByTestId('status-button-1'));
    
    // Check if onStatusChange was called with the correct parameters
    expect(mockProps.onStatusChange).toHaveBeenCalledWith(1, 'done');
  });

  test('handles PDF deletion correctly', async () => {
    const user = userEvent.setup();
    render(<ClassView {...mockProps} />);
    
    // Click on the delete button for PDF 1
    await user.click(screen.getByTestId('delete-button-1'));
    
    // Check if onDeletePDF was called with the correct parameter
    expect(mockProps.onDeletePDF).toHaveBeenCalledWith(1);
  });

  test('handles PDF viewing correctly', async () => {
    const user = userEvent.setup();
    render(<ClassView {...mockProps} />);
    
    // Click on the view button for PDF 1
    await user.click(screen.getByTestId('view-button-1'));
    
    // Check if onViewPDF was called with the correct PDF
    expect(mockProps.onViewPDF).toHaveBeenCalledWith(mockPDFs[0]);
  });

  test('shows loading spinner when processing', () => {
    render(<ClassView {...mockProps} isProcessing={true} pdfs={[]} />);
    
    // Check if loading spinner is rendered
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    
    // PDFList should not be rendered
    expect(screen.queryByTestId('pdf-list')).not.toBeInTheDocument();
  });
});
