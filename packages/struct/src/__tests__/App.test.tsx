// src/__tests__/App.test.tsx
import { indexedDB } from 'fake-indexeddb';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, expect, describe, beforeEach, test, type Mock } from 'vitest';
import type { Mocked } from 'vitest'; // Use type-only import
import React from 'react';

// --- Mock Setup ---

// 1. Mock Hooks, Utils, and Underlying UI Components FIRST

// Mock useDBInitialization
const mockDBState = {
  isDBInitialized: true,
  dbError: null,
  isInitializing: false
};
vi.mock('../hooks/useDBInitialization', () => ({
  useDBInitialization: () => mockDBState
}));

// Mock NotFoundView component
vi.mock('../components/NotFoundView', () => ({
  // Default export is the mock function
  default: vi.fn(() => React.createElement('div', { 'data-testid': 'not-found-view' }, 'Not Found'))
}));

// Mock db utils - Keep this comprehensive
vi.mock('../utils/db', () => ({
  getClasses: vi.fn().mockResolvedValue([]), // Start with empty for less noise in DOM unless needed
  addClass: vi.fn().mockResolvedValue({ id: 'new', name: 'New Class' }),
  deleteClass: vi.fn().mockResolvedValue(undefined),
  updateClass: vi.fn().mockResolvedValue(undefined),
  getClass: vi.fn().mockResolvedValue({ id: 'test-class-1', name: 'Test Class', notes: '' }),
  getClassPDFs: vi.fn().mockResolvedValue([]), // Start with empty
  getPDF: vi.fn().mockResolvedValue({ id: 123, name: 'Test PDF', status: 'to-study', classId: 'test-class-1', order: 0, createdAt: new Date(), pageCount: 10, currentPage: 0, fileData: new ArrayBuffer(10) }),
  addPDF: vi.fn().mockResolvedValue({ id: 3, name: 'Added PDF', classId: 'test-class-1' }),
  updatePDF: vi.fn().mockResolvedValue(undefined),
  deletePDF: vi.fn().mockResolvedValue(undefined),
  updatePDFOrder: vi.fn().mockResolvedValue(undefined),
  initDB: vi.fn().mockResolvedValue(undefined),
}));

// --- Mock the ACTUAL UI components rendered by the wrappers ---
vi.mock('../components/ClassManagement', () => ({
  default: vi.fn(() => React.createElement('div', { 'data-testid': 'class-management-component' }))
}));
vi.mock('../components/ClassView', () => ({
  default: vi.fn(() => React.createElement('div', { 'data-testid': 'class-view-component' }))
}));
vi.mock('../components/PDFViewer', () => ({
  default: vi.fn(() => React.createElement('div', { 'data-testid': 'pdf-viewer-component' }))
}));

// --- DO NOT Mock '../App' itself ---

// 3. Mock Global APIs
vi.stubGlobal('indexedDB', indexedDB);

// --- Imports AFTER Mocks ---
// Import the ACTUAL App and its ACTUAL wrappers
import App from '../App';
// Import the MOCKED underlying components to spy on them
import MockedClassManagement from '../components/ClassManagement';
import MockedClassView from '../components/ClassView';
import MockedPDFViewer from '../components/PDFViewer';
import MockedNotFoundView from '../components/NotFoundView'; // Import the mock itself
// Import mocked DB functions if needed for resetting in beforeEach
import { getPDF as mockGetPDF, getClass as mockGetClass } from '../utils/db';


// --- Typed Mocks for Assertions ---
// Cast the IMPORTED mocks of the underlying components
const mockClassManagementComponent = MockedClassManagement as Mocked<typeof MockedClassManagement>;
const mockClassViewComponent = MockedClassView as Mocked<typeof MockedClassView>;
const mockPDFViewerComponent = MockedPDFViewer as Mocked<typeof MockedPDFViewer>;
const mockedNotFoundViewComponent = MockedNotFoundView as Mocked<typeof MockedNotFoundView>;
// Cast imported DB mocks
const mockedGetPDF = mockGetPDF as Mock; // Cast to Mock
const mockedGetClass = mockGetClass as Mock; // Cast to Mock


// --- Test Setup ---
const renderWithRouter = (initialEntries = ['/']) => {
  return render(
    <MemoryRouter initialEntries={initialEntries} initialIndex={0}>
      {/* Render the ACTUAL App */}
      <App />
    </MemoryRouter>
  );
};

// --- Test Suite ---
describe('App Routing and State', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(mockDBState, {
      isDBInitialized: true,
      dbError: null,
      isInitializing: false
    });

    // Reset DB mocks if needed
    mockedGetPDF.mockResolvedValue({ id: 123, name: 'Test PDF', status: 'to-study', classId: 'test-class-1', order: 0, createdAt: new Date(), pageCount: 10, currentPage: 0, fileData: new ArrayBuffer(10) });
    mockedGetClass.mockResolvedValue({ id: 'test-class-1', name: 'Test Class', notes: '' });
  });

  // --- Routing Tests ---
  describe('App Routing', () => {
    test('renders ClassManagement component for "/" route', async () => {
      renderWithRouter(['/']);
      // Expect the MOCKED underlying component's test ID
      expect(await screen.findByTestId('class-management-component')).toBeInTheDocument();
      // Expect the MOCKED underlying component to have been called
      expect(mockClassManagementComponent).toHaveBeenCalledTimes(1);
    });

    test('renders ClassManagement component for "/classes" route', async () => {
      renderWithRouter(['/classes']);
      expect(await screen.findByTestId('class-management-component')).toBeInTheDocument();
      expect(mockClassManagementComponent).toHaveBeenCalledTimes(1);
    });

    test('renders ClassView component for "/classes/:classId" route', async () => {
      renderWithRouter(['/classes/test-class-1']);
      // Need to wait for potential loading state in ClassViewWrapper
      await waitFor(() => {
        expect(mockedGetClass).toHaveBeenCalledWith('test-class-1');
        // Add mocks for other calls if needed by ClassViewWrapper/useClassData
      });
      expect(await screen.findByTestId('class-view-component')).toBeInTheDocument();
      expect(mockClassViewComponent).toHaveBeenCalledTimes(1);
      // Optionally check props passed to the mock
      // expect(mockClassViewComponent).toHaveBeenCalledWith(expect.objectContaining({ selectedClass: expect.any(Object) }), expect.anything());
    });

    test('renders PDFViewer component for "/classes/:classId/pdf/:pdfId" route', async () => {
      renderWithRouter(['/classes/test-class-1/pdf/123']);
      // Wait for data fetching within PDFViewerWrapper
      await waitFor(() => {
        expect(mockedGetClass).toHaveBeenCalledWith('test-class-1');
        expect(mockedGetPDF).toHaveBeenCalledWith(123);
      });
      expect(await screen.findByTestId('pdf-viewer-component')).toBeInTheDocument();
      expect(mockPDFViewerComponent).toHaveBeenCalledTimes(1);
      // Optionally check props passed to the mock
      // expect(mockPDFViewerComponent).toHaveBeenCalledWith(expect.objectContaining({ pdf: expect.any(Object) }), expect.anything());
    });
  });

  test('renders NotFoundView component for unknown routes', async () => {
    renderWithRouter(['/some/unknown/route']);
    expect(await screen.findByTestId('not-found-view')).toBeInTheDocument();
    expect(screen.getByText('Not Found')).toBeInTheDocument();

    // Assert the mock function itself was called
    expect(mockedNotFoundViewComponent).toHaveBeenCalledTimes(1);

    // Corrected Assertion: Expect props object and explicitly undefined as the second argument
    expect(mockedNotFoundViewComponent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'Page' }),
      undefined // <-- Explicitly expect undefined here
    );

    // Ensure underlying UI mocks were NOT called
    expect(mockClassManagementComponent).not.toHaveBeenCalled();
    expect(mockClassViewComponent).not.toHaveBeenCalled();
    expect(mockPDFViewerComponent).not.toHaveBeenCalled();
  });

  // --- DB Initialization State Tests ---
  describe('DB Initialization States', () => {
    test('handles DB Initialization loading state', async () => {
      Object.assign(mockDBState, {
        isDBInitialized: false,
        isInitializing: true,
        dbError: null
      });
      render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>);
      expect(await screen.findByText('Initializing Application...')).toBeInTheDocument();
      // Ensure underlying UI mocks weren't called
      expect(screen.queryByTestId('class-management-component')).not.toBeInTheDocument();
      expect(mockClassManagementComponent).not.toHaveBeenCalled();
    });

    test('handles DB Initialization error state', async () => {
      const mockError = new Error("DB Init Failed");
      Object.assign(mockDBState, {
        isDBInitialized: false,
        dbError: mockError,
        isInitializing: false
      });
      render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>);
      expect(await screen.findByText('Database Error')).toBeInTheDocument();
      expect(await screen.findByText(/Could not initialize the application database/)).toBeInTheDocument();
      expect(await screen.findByText(/DB Init Failed/)).toBeInTheDocument();
      // Ensure underlying UI mocks weren't called
      expect(screen.queryByTestId('class-management-component')).not.toBeInTheDocument();
      expect(mockClassManagementComponent).not.toHaveBeenCalled();
    });
  });
});