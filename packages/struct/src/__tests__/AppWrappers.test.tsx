// Original path: __tests__/AppWrappers.test.tsx
// src/__tests__/AppWrappers.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event'; // Keep userEvent import
import { MemoryRouter, Routes, Route } from 'react-router-dom'; // Removed useParams, useNavigate as they are mocked globally
import { vi, expect, describe, beforeEach, test, type Mock } from 'vitest'; // Removed afterEach as it's not used
import { ClassManagementWrapper, ClassViewWrapper, PDFViewerWrapper } from '../App'; // Corrected path
import { useClassData } from '../hooks/useClassData';          // Corrected path
import { usePDFOperations } from '../hooks/usePDFOperations';  // Corrected path
import { useClassNotes } from '../hooks/useClassNotes';        // Corrected path
import { useDBInitialization } from '../hooks/useDBInitialization';// Corrected path
import { getPDF, getClass } from '../utils/db';
import type { Class, PDF } from '../utils/types';

// Import the functions that will be mocked by the factory
import { useParams, useNavigate } from 'react-router-dom';
import PDFViewer from '../components/PDFViewer'; // Import for mocking PDFViewer in specific test

// --- Global Mocks ---
vi.mock('react-router-dom', async (importOriginal) => {
  const original = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...original,
    useParams: vi.fn(), // This is the mock function
    useNavigate: vi.fn(), // This is the mock function
  };
});
vi.mock('../hooks/useDBInitialization');
vi.mock('../hooks/useClassData');
vi.mock('../hooks/usePDFOperations');
vi.mock('../hooks/useClassNotes');
vi.mock('../utils/db');

// Mock Child Components (the actual views rendered by wrappers)
vi.mock('../components/ClassManagement', () => ({
  default: vi.fn(({ onSelectClass, onCreateClass }) => (
    <div data-testid="actual-class-management">
      <button onClick={() => onSelectClass('selected-id')} data-testid="select-class-cm">Select</button>
      <button onClick={() => onCreateClass('created-id')} data-testid="create-class-cm">Create</button>
    </div>
  )),
}));
vi.mock('../components/ClassView', () => ({
  default: vi.fn((props) => <div data-testid="actual-class-view">{props.selectedClass?.name}</div>),
}));
vi.mock('../components/PDFViewer', () => ({ // Global mock for PDFViewer
  default: vi.fn((props) => <div data-testid="actual-pdf-viewer">{props.pdf?.name}</div>),
}));
vi.mock('../components/LoadingView', () => ({ default: vi.fn(() => <div data-testid="loading-view">Loading...</div>) }));
// Ensure ErrorView mock renders the test ID correctly
vi.mock('../components/ErrorView', () => ({
  default: vi.fn(({ message }) => <div data-testid="error-view">{message}</div>)
}));
vi.mock('../components/NotFoundView', () => ({ default: vi.fn(() => <div data-testid="not-found-view">Not Found</div>) }));
vi.mock('../components/Header', () => ({ default: vi.fn(() => <div data-testid="header">Header</div>) }));
vi.mock('../components/Footer', () => ({ default: vi.fn(() => <div data-testid="footer">Footer</div>) }));


// --- Mock Implementations & Data ---
const mockNavigate = vi.fn();
const mockRefreshData = vi.fn().mockResolvedValue(undefined); // Ensure it returns a promise
const mockSetSelectedClass = vi.fn();
const mockSetPdfs = vi.fn();
const mockHandleFileUpload = vi.fn().mockResolvedValue(undefined);
const mockHandleStatusChange = vi.fn().mockResolvedValue(undefined);
const mockHandleDeletePDF = vi.fn().mockResolvedValue(undefined);
const mockHandlePDFOrderChange = vi.fn().mockResolvedValue(undefined);
const mockHandleClassNotesChange = vi.fn();

const mockClassInstance: Class = { id: 'c1', name: 'Test Class Wrapper', pdfCount: 1, doneCount: 0, dateCreated: Date.now(), notes: 'notes' };
const mockPdfInstance: PDF = { id: 1, name: 'Test PDF Wrapper', classId: 'c1', status: 'to-study', size: 100, dateAdded: Date.now(), lastModified: Date.now() };

// Default healthy hook return values
const setDefaultHookMocks = () => {
  // Use the imported functions which are already mocks due to the factory
  vi.mocked(useParams).mockReturnValue({}); // Default, override per test
  vi.mocked(useNavigate).mockReturnValue(mockNavigate);
  vi.mocked(useDBInitialization).mockReturnValue({ isDBInitialized: true, dbError: null, isInitializing: false });
  vi.mocked(useClassData).mockReturnValue({
    selectedClass: mockClassInstance,
    setSelectedClass: mockSetSelectedClass,
    pdfs: [mockPdfInstance],
    setPdfs: mockSetPdfs,
    isLoadingClassData: false,
    classDataError: null,
    refreshData: mockRefreshData,
  });
  vi.mocked(usePDFOperations).mockReturnValue({
    isProcessing: false,
    handleFileUpload: mockHandleFileUpload,
    handleStatusChange: mockHandleStatusChange,
    handleDeletePDF: mockHandleDeletePDF,
    handlePDFOrderChange: mockHandlePDFOrderChange,
  });
  vi.mocked(useClassNotes).mockReturnValue({ handleClassNotesChange: mockHandleClassNotesChange });
  (getPDF as Mock).mockResolvedValue(mockPdfInstance);
  (getClass as Mock).mockResolvedValue(mockClassInstance);
};

describe('App Wrapper Components', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setDefaultHookMocks();
  });

  // --- ClassManagementWrapper Tests ---
  describe('ClassManagementWrapper', () => {
    // MemoryRouter initialEntries are paths *without* the basename
    // The routes defined *inside* the test should match what App.tsx defines.
    const renderCMWrapper = () => render(
      <MemoryRouter initialEntries={['/classes']}>
        <Routes>
          <Route path="/classes" element={<ClassManagementWrapper />} /> {/* Match App.tsx route */}
        </Routes>
      </MemoryRouter>
    );

    test('renders ClassManagement and handles class selection', async () => {
      const user = userEvent.setup();
      renderCMWrapper();
      expect(screen.getByTestId('actual-class-management')).toBeInTheDocument();
      await user.click(screen.getByTestId('select-class-cm'));
      expect(mockNavigate).toHaveBeenCalledWith('/classes/selected-id');
    });

    test('handles class creation', async () => {
      const user = userEvent.setup();
      renderCMWrapper();
      await user.click(screen.getByTestId('create-class-cm'));
      expect(mockNavigate).toHaveBeenCalledWith('/classes/created-id');
    });
  });

  // --- ClassViewWrapper Tests ---
  describe('ClassViewWrapper', () => {
    // `initialPath` will be the entry for MemoryRouter, without basename
    const renderCVWrapper = (classId = 'c1', initialPath?: string) => {
      vi.mocked(useParams).mockReturnValue({ classId });
      return render(
        <MemoryRouter initialEntries={[initialPath || `/classes/${classId}`]}>
          <Routes><Route path="/classes/:classId" element={<ClassViewWrapper />} /></Routes>
        </MemoryRouter>
      );
    };

    test('renders loading state', () => {
      vi.mocked(useClassData).mockReturnValueOnce({
        selectedClass: null, setSelectedClass: vi.fn(), pdfs: [], setPdfs: vi.fn(),
        isLoadingClassData: true, classDataError: null, refreshData: vi.fn()
      });
      renderCVWrapper();
      expect(screen.getByTestId('loading-view')).toBeInTheDocument();
    });

    test('renders error state', () => {
      const error = new Error('Fetch failed');
      vi.mocked(useClassData).mockReturnValueOnce({
        selectedClass: null, setSelectedClass: vi.fn(), pdfs: [], setPdfs: vi.fn(),
        isLoadingClassData: false, classDataError: error, refreshData: vi.fn()
      });
      renderCVWrapper();
      expect(screen.getByTestId('error-view')).toHaveTextContent('Fetch failed');
    });

    test('renders not found if class is null after loading and no error', () => {
      vi.mocked(useClassData).mockReturnValueOnce({
        selectedClass: null, setSelectedClass: vi.fn(), pdfs: [], setPdfs: vi.fn(),
        isLoadingClassData: false, classDataError: null, refreshData: vi.fn()
      });
      renderCVWrapper('nonExistentId');
      expect(screen.getByTestId('not-found-view')).toBeInTheDocument();
    });

    test('renders ClassView with fetched data', async () => {
      renderCVWrapper('c1');
      await waitFor(() => expect(screen.getByTestId('actual-class-view')).toBeInTheDocument());
      expect(screen.getByTestId('actual-class-view')).toHaveTextContent(mockClassInstance.name);
      expect(useClassData).toHaveBeenCalledWith(true, 'c1');
    });
  });


  // --- PDFViewerWrapper Tests ---
  describe('PDFViewerWrapper', () => {
    const renderPVWrapper = (classIdParam: string | undefined, pdfIdParam: string, initialPathOverride?: string) => {
      vi.mocked(useParams).mockReturnValue({ classId: classIdParam, pdfId: pdfIdParam });
      const defaultInitialPath = classIdParam ? `/classes/${classIdParam}/pdf/${pdfIdParam}` : `/pdf/${pdfIdParam}`; // Fallback if classId is truly undefined for URL
      return render(
        <MemoryRouter initialEntries={[initialPathOverride || defaultInitialPath]}>
          <Routes><Route path="/classes/:classId/pdf/:pdfId" element={<PDFViewerWrapper />} /></Routes>
        </MemoryRouter>
      );
    };


    test('renders loading initially', async () => {
      vi.mocked(getPDF).mockImplementation(() => new Promise(() => {}));
      renderPVWrapper('c1', '1');
      expect(screen.getByTestId('loading-view')).toBeInTheDocument();
      await waitFor(() => {}); // Settle promises
    });


    test('renders error if getPDF fails', async () => {
      (getPDF as Mock).mockRejectedValue(new Error('PDF fetch failed'));
      renderPVWrapper('c1','1');
      await waitFor(() => expect(screen.getByTestId('error-view')).toHaveTextContent('PDF fetch failed'));
    });

    test('renders error if getClass fails', async () => {
      (getClass as Mock).mockRejectedValue(new Error('Class fetch failed'));
      renderPVWrapper('c1','1');
      await waitFor(() => expect(screen.getByTestId('error-view')).toHaveTextContent('Class fetch failed'));
    });

    test('renders error if PDF does not belong to class', async () => {
      (getPDF as Mock).mockResolvedValueOnce({ ...mockPdfInstance, classId: 'wrong-class' });
      renderPVWrapper('c1','1');
      await waitFor(() => expect(screen.getByTestId('error-view')).toHaveTextContent(/does not belong to class/i));
    });

    test('renders not found if PDF is null after loading', async () => {
      (getPDF as Mock).mockResolvedValue(undefined); // Changed from null
      renderPVWrapper('c1','1');
      await waitFor(() => {
        expect(screen.getByTestId('error-view')).toBeInTheDocument();
        expect(screen.getByTestId('error-view')).toHaveTextContent(/PDF with ID 1 not found/i);
      });
    });

    test('renders not found if Class is null after loading', async () => {
      (getClass as Mock).mockResolvedValue(undefined); // Changed from null
      renderPVWrapper('c1','1');
      await waitFor(() => {
        expect(screen.getByTestId('error-view')).toBeInTheDocument();
        expect(screen.getByTestId('error-view')).toHaveTextContent(/Class with ID c1 not found/i);
      });
    });

    test('renders PDFViewer with fetched data', async () => {
      renderPVWrapper('c1', '1');
      await waitFor(() => expect(screen.getByTestId('actual-pdf-viewer')).toBeInTheDocument());
      expect(screen.getByTestId('actual-pdf-viewer')).toHaveTextContent(mockPdfInstance.name);
      expect(getPDF).toHaveBeenCalledWith(1);
      expect(getClass).toHaveBeenCalledWith('c1');
    });

    test('handles close navigation', async () => {
      vi.mocked(PDFViewer).mockImplementationOnce(({ onClose }: { onClose: () => void }) => ( // Explicitly type onClose
        <div data-testid="actual-pdf-viewer"><button onClick={onClose} data-testid="close-pv">Close</button></div>
      ));

      const user = userEvent.setup();
      renderPVWrapper('c1', '1');
      await waitFor(() => expect(screen.getByTestId('actual-pdf-viewer')).toBeInTheDocument());
      await user.click(screen.getByTestId('close-pv'));
      expect(mockNavigate).toHaveBeenCalledWith('/classes/c1');
    });
        
    test('handles invalid pdfId (NaN) gracefully', async () => {
      // Provide a valid-looking path for MemoryRouter so the route matching works
      const validPathForRouteMatcher = '/classes/c1/pdf/invalid-pdf-id';
      // Mock useParams to return the problematic NaN pdfId for the component's internal logic
      vi.mocked(useParams).mockReturnValue({ classId: 'c1', pdfId: 'invalid-pdf-id' });
            
      render(
        <MemoryRouter initialEntries={[validPathForRouteMatcher]}>
          <Routes><Route path="/classes/:classId/pdf/:pdfId" element={<PDFViewerWrapper />} /></Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('error-view')).toBeInTheDocument();
        // The error message should reflect that 'invalid-pdf-id' was used.
        expect(screen.getByTestId('error-view')).toHaveTextContent(/Invalid Class ID \('c1'\) or PDF ID \('invalid-pdf-id'\)/);
      });
    });

    test('handles invalid classId (from useParams returning undefined) gracefully', async () => {
      const validPathForRouteMatcher = '/classes/some-class-in-url/pdf/1';
      // Critical: Mock useParams to return undefined for classId *for the component's logic*
      vi.mocked(useParams).mockReturnValue({ classId: undefined as unknown as string, pdfId: '1' }); // Cast to unknown first

      render(
        <MemoryRouter initialEntries={[validPathForRouteMatcher]}>
          <Routes>
            <Route path="/classes/:classId/pdf/:pdfId" element={<PDFViewerWrapper />} />
          </Routes>
        </MemoryRouter>
      );
             
      await waitFor(() => {
        expect(screen.getByTestId('error-view')).toBeInTheDocument();
        // The error message should show 'undefined' for classId
        expect(screen.getByTestId('error-view')).toHaveTextContent(/Invalid Class ID \('undefined'\) or PDF ID \('1'\)/);
      });
    });
  });
});