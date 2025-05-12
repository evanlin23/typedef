import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, expect, describe, beforeEach, test } from 'vitest';
import App from '../App';
import type { Class, PDF } from '../utils/types';

// Mock the database utilities
vi.mock('../utils/db', () => ({
  initDB: vi.fn(),
  getClasses: vi.fn(),
  getClass: vi.fn(),
  getClassPDFs: vi.fn(),
  addPDF: vi.fn(),
  updatePDFStatus: vi.fn(),
  deletePDF: vi.fn(),
  updateMultiplePDFOrders: vi.fn(),
  updateClassNotes: vi.fn()
}));

// Import the mocked modules
import { initDB, getClass, getClassPDFs } from '../utils/db';

// Mock child components
vi.mock('../components/ClassManagement', () => ({
  default: vi.fn(({ onSelectClass, onCreateClass }) => (
    <div data-testid="class-management">
      <button data-testid="select-class-button" onClick={() => onSelectClass('test-class-id')}>
        Select Class
      </button>
      <button data-testid="create-class-button" onClick={() => onCreateClass('new-class-id')}>
        Create Class
      </button>
    </div>
  ))
}));

vi.mock('../components/ClassView', () => ({
  default: vi.fn(({ 
    selectedClass, 
    pdfs, 
    activeTab, 
    onTabChange,
    onFileUpload,
    onStatusChange,
    onDeletePDF,
    onViewPDF,
    onPDFOrderChange,
    onNotesChange
  }) => (
    <div data-testid="class-view">
      <div data-testid="class-name">{selectedClass.name}</div>
      <div data-testid="pdfs-count">{pdfs.length}</div>
      <div data-testid="active-tab">{activeTab}</div>
      <button data-testid="change-tab" onClick={() => onTabChange(activeTab === 'to-study' ? 'done' : 'to-study')}>
        Change Tab
      </button>
      <button data-testid="upload-file" onClick={() => onFileUpload(new DataTransfer().files)}>
        Upload File
      </button>
      <button data-testid="change-status" onClick={() => onStatusChange(1, 'done')}>
        Change Status
      </button>
      <button data-testid="delete-pdf" onClick={() => onDeletePDF(1)}>
        Delete PDF
      </button>
      {pdfs.length > 0 && (
        <button data-testid="view-pdf" onClick={() => onViewPDF(pdfs[0])}>
          View PDF
        </button>
      )}
      <button data-testid="change-order" onClick={() => onPDFOrderChange(pdfs)}>
        Change Order
      </button>
      <button data-testid="change-notes" onClick={() => onNotesChange('New notes')}>
        Change Notes
      </button>
    </div>
  ))
}));

vi.mock('../components/PDFViewer', () => ({
  default: vi.fn(({ pdf, onClose, onStatusChange, classNotes, onClassNotesChange }) => (
    <div data-testid="pdf-viewer">
      <div data-testid="pdf-name">{pdf.name}</div>
      <button data-testid="close-pdf" onClick={onClose}>Close PDF</button>
      <button data-testid="change-pdf-status" onClick={() => onStatusChange(pdf.id, 'done')}>
        Change Status
      </button>
      <div data-testid="class-notes">{classNotes}</div>
      <button data-testid="change-class-notes" onClick={() => onClassNotesChange('Updated notes')}>
        Update Notes
      </button>
    </div>
  ))
}));

vi.mock('../components/LoadingView', () => ({
  default: vi.fn(({ message, onBackClick, showBackButton }) => (
    <div data-testid="loading-view">
      <div data-testid="loading-message">{message}</div>
      {showBackButton && (
        <button data-testid="back-button" onClick={onBackClick}>
          Back
        </button>
      )}
    </div>
  ))
}));

vi.mock('../components/ErrorView', () => ({
  default: vi.fn(({ title, message, onBackClick }) => (
    <div data-testid="error-view">
      <div data-testid="error-title">{title}</div>
      <div data-testid="error-message">{message}</div>
      <button data-testid="error-back-button" onClick={onBackClick}>
        Back
      </button>
    </div>
  ))
}));

vi.mock('../components/Header', () => ({
  default: vi.fn(({ pageTitle, onBackClick, showBackButton }) => (
    <header data-testid="header">
      <div data-testid="page-title">{pageTitle}</div>
      {showBackButton && (
        <button data-testid="header-back-button" onClick={onBackClick}>
          Back
        </button>
      )}
    </header>
  ))
}));

vi.mock('../components/Footer', () => ({
  default: vi.fn(() => <footer data-testid="footer">Footer</footer>)
}));

describe('App Component', () => {
  const mockClass: Class = {
    id: 'test-class-id',
    name: 'Test Class',
    dateCreated: Date.now(),
    isPinned: false,
    pdfCount: 2,
    doneCount: 1,
    notes: 'Test notes',
    progress: 50,
    completedItems: 1,
    totalItems: 2
  };

  const mockPDFs: PDF[] = [
    {
      id: 1,
      name: 'Test PDF 1.pdf',
      size: 1024,
      lastModified: Date.now(),
      data: new ArrayBuffer(0),
      status: 'to-study',
      dateAdded: Date.now(),
      classId: 'test-class-id',
      orderIndex: 0
    },
    {
      id: 2,
      name: 'Test PDF 2.pdf',
      size: 2048,
      lastModified: Date.now(),
      data: new ArrayBuffer(0),
      status: 'done',
      dateAdded: Date.now(),
      classId: 'test-class-id',
      orderIndex: 1
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock implementations
    (initDB as jest.Mock).mockResolvedValue(undefined);
    (getClass as jest.Mock).mockResolvedValue(mockClass);
    (getClassPDFs as jest.Mock).mockResolvedValue(mockPDFs);
  });

  test('renders loading view during database initialization', async () => {
    // Mock DB initialization in progress
    (initDB as jest.Mock).mockImplementationOnce(() => new Promise(() => {
      // Never resolve to keep in loading state
      setTimeout(() => {}, 1000);
    }));

    render(<App />);
    
    expect(screen.getByTestId('loading-view')).toBeInTheDocument();
    expect(screen.getByTestId('loading-message').textContent).toContain('Initializing Application');
  });

  test('renders error view when database initialization fails', async () => {
    // Mock DB initialization failure
    const dbError = new Error('Failed to initialize database');
    (initDB as jest.Mock).mockRejectedValueOnce(dbError);

    render(<App />);
    
    // Wait for error view to appear
    await waitFor(() => {
      expect(screen.getByTestId('error-view')).toBeInTheDocument();
    });
    
    expect(screen.getByTestId('error-title').textContent).toContain('Database Error');
    expect(screen.getByTestId('error-message').textContent).toContain('Failed to initialize database');
  });

  test('renders class management when no class is selected', async () => {
    render(<App />);
    
    // Wait for DB initialization and class management to render
    await waitFor(() => {
      expect(screen.getByTestId('class-management')).toBeInTheDocument();
    });
  });

  test('handles class selection', async () => {
    const user = userEvent.setup();
    render(<App />);
    
    // Wait for class management to render
    await waitFor(() => {
      expect(screen.getByTestId('class-management')).toBeInTheDocument();
    });
    
    // Select a class
    await user.click(screen.getByTestId('select-class-button'));
    
    // Wait for class view to render
    await waitFor(() => {
      expect(screen.getByTestId('class-view')).toBeInTheDocument();
    });
    
    // Verify class data is displayed
    expect(screen.getByTestId('class-name').textContent).toBe('Test Class');
    expect(screen.getByTestId('pdfs-count').textContent).toBe('2');
  });

  test('handles class creation', async () => {
    const user = userEvent.setup();
    render(<App />);
    
    // Wait for class management to render
    await waitFor(() => {
      expect(screen.getByTestId('class-management')).toBeInTheDocument();
    });
    
    // Create a class
    await user.click(screen.getByTestId('create-class-button'));
    
    // Wait for class view to render (after class creation)
    await waitFor(() => {
      expect(screen.getByTestId('class-view')).toBeInTheDocument();
    });
  });

  test('handles tab navigation', async () => {
    const user = userEvent.setup();
    
    // Setup for a selected class
    render(<App />);
    
    // Wait for class management to render
    await waitFor(() => {
      expect(screen.getByTestId('class-management')).toBeInTheDocument();
    });
    
    // Select a class
    await user.click(screen.getByTestId('select-class-button'));
    
    // Wait for class view to render
    await waitFor(() => {
      expect(screen.getByTestId('class-view')).toBeInTheDocument();
    });
    
    // Initial tab should be 'to-study'
    expect(screen.getByTestId('active-tab').textContent).toBe('to-study');
    
    // Change tab
    await user.click(screen.getByTestId('change-tab'));
    
    // Tab should now be 'done'
    expect(screen.getByTestId('active-tab').textContent).toBe('done');
  });

  test('handles PDF viewing and closing', async () => {
    const user = userEvent.setup();
    
    // Setup for a selected class with PDFs
    render(<App />);
    
    // Wait for class management to render and select a class
    await waitFor(() => {
      expect(screen.getByTestId('class-management')).toBeInTheDocument();
    });
    await user.click(screen.getByTestId('select-class-button'));
    
    // Wait for class view to render
    await waitFor(() => {
      expect(screen.getByTestId('class-view')).toBeInTheDocument();
    });
    
    // View a PDF
    await user.click(screen.getByTestId('view-pdf'));
    
    // PDF viewer should be rendered
    expect(screen.getByTestId('pdf-viewer')).toBeInTheDocument();
    expect(screen.getByTestId('pdf-name').textContent).toBe('Test PDF 1.pdf');
    
    // Close the PDF viewer
    await user.click(screen.getByTestId('close-pdf'));
    
    // PDF viewer should be closed
    expect(screen.queryByTestId('pdf-viewer')).not.toBeInTheDocument();
  });

  test('handles going back to class list', async () => {
    const user = userEvent.setup();
    
    // Setup for a selected class
    render(<App />);
    
    // Wait for class management to render and select a class
    await waitFor(() => {
      expect(screen.getByTestId('class-management')).toBeInTheDocument();
    });
    await user.click(screen.getByTestId('select-class-button'));
    
    // Wait for class view to render
    await waitFor(() => {
      expect(screen.getByTestId('class-view')).toBeInTheDocument();
    });
    
    // Go back to class list
    await user.click(screen.getByTestId('header-back-button'));
    
    // Should be back at class management
    expect(screen.getByTestId('class-management')).toBeInTheDocument();
  });

  test('handles class loading error', async () => {
    // Mock class loading failure
    (getClass as jest.Mock).mockRejectedValueOnce(
      new Error('Failed to load class data')
    );
    
    const user = userEvent.setup();
    render(<App />);
    
    // Wait for class management to render
    await waitFor(() => {
      expect(screen.getByTestId('class-management')).toBeInTheDocument();
    });
    
    // Select a class
    await user.click(screen.getByTestId('select-class-button'));
    
    // Should show error view
    await waitFor(() => {
      expect(screen.getByTestId('error-view')).toBeInTheDocument();
    });
    
    expect(screen.getByTestId('error-title').textContent).toContain('Error Loading Class Data');
  });

  test('handles class not found error', async () => {
    // Mock class not found
    (getClass as jest.Mock).mockResolvedValueOnce(null);
    
    const user = userEvent.setup();
    render(<App />);
    
    // Wait for class management to render
    await waitFor(() => {
      expect(screen.getByTestId('class-management')).toBeInTheDocument();
    });
    
    // Select a class
    await user.click(screen.getByTestId('select-class-button'));
    
    // Should show error view
    await waitFor(() => {
      expect(screen.getByTestId('error-view')).toBeInTheDocument();
    });
  });
});
