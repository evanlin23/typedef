import { renderHook, act } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach, afterAll } from 'vitest';
import { usePDFOperations } from '../../hooks/usePDFOperations';
import { addPDF, updatePDFStatus, deletePDF, updateMultiplePDFOrders } from '../../utils/db';
import type { PDF } from '../../utils/types';

// Mock the db utility functions
vi.mock('../../utils/db', () => ({
  addPDF: vi.fn().mockResolvedValue(undefined),
  updatePDFStatus: vi.fn().mockResolvedValue(undefined),
  deletePDF: vi.fn().mockResolvedValue(undefined),
  updateMultiplePDFOrders: vi.fn().mockResolvedValue(undefined)
}));

// Mock console methods
const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

// Mock alert
global.alert = vi.fn();

// Mock File.prototype.arrayBuffer
Object.defineProperty(File.prototype, 'arrayBuffer', {
  value: vi.fn().mockResolvedValue(new ArrayBuffer(10)),
  configurable: true
});

// Mock DataTransfer for testing environment
class MockDataTransfer {
  items: { add: (file: File) => void };
  files: FileList;

  constructor() {
    const fileList: File[] = [];
    this.items = {
      add: (file: File) => fileList.push(file)
    };
    this.files = Object.assign(fileList, { item: (index: number) => fileList[index] });
  }
}

global.DataTransfer = MockDataTransfer as any;

describe('usePDFOperations Hook', () => {
  const mockPDFs: PDF[] = [
    {
      id: 1,
      name: 'PDF 1.pdf',
      dateAdded: Date.now(),
      size: 1024,
      status: 'to-study',
      classId: 'class-1',
      data: new Uint8Array([1, 2, 3]),
      orderIndex: 0,
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
      orderIndex: 1,
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
      orderIndex: 2,
      lastModified: Date.now()
    }
  ];

  const mockSetPdfs = vi.fn();
  const mockSetViewingPDF = vi.fn();
  const mockRefreshData = vi.fn().mockResolvedValue(undefined);

  const defaultProps = {
    selectedClassId: 'class-1',
    pdfs: mockPDFs,
    setPdfs: mockSetPdfs,
    viewingPDF: null,
    setViewingPDF: mockSetViewingPDF,
    refreshData: mockRefreshData
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('initializes with correct state and functions', () => {
    const { result } = renderHook(() => usePDFOperations(defaultProps));
    
    // Check initial state
    expect(result.current.isProcessing).toBe(false);
    
    // Check if all functions are defined
    expect(result.current.handleFileUpload).toBeDefined();
    expect(result.current.handleStatusChange).toBeDefined();
    expect(result.current.handleDeletePDF).toBeDefined();
    expect(result.current.handlePDFOrderChange).toBeDefined();
  });

  describe('handleFileUpload', () => {
    test('shows alert if no class is selected', async () => {
      const { result } = renderHook(() => 
        usePDFOperations({
          ...defaultProps,
          selectedClassId: null
        })
      );
      
      // Create a mock FileList
      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      const files = dataTransfer.files;
      
      // Call handleFileUpload
      await act(async () => {
        await result.current.handleFileUpload(files);
      });
      
      // Alert should be called
      expect(global.alert).toHaveBeenCalledWith('Please select a class before uploading files.');
      
      // isProcessing should remain false
      expect(result.current.isProcessing).toBe(false);
      
      // addPDF should not be called
      expect(addPDF).not.toHaveBeenCalled();
    });

    test('handles empty file list', async () => {
      const { result } = renderHook(() => usePDFOperations(defaultProps));
      
      // Create an empty FileList
      const dataTransfer = new DataTransfer();
      const files = dataTransfer.files;
      
      // Call handleFileUpload
      await act(async () => {
        await result.current.handleFileUpload(files);
      });
      
      // isProcessing should remain false
      expect(result.current.isProcessing).toBe(false);
      
      // addPDF should not be called
      expect(addPDF).not.toHaveBeenCalled();
    });

    test('filters out non-PDF files', async () => {
      const { result } = renderHook(() => usePDFOperations(defaultProps));
      
      // Create a mixed FileList with PDF and non-PDF files
      const pdfFile = new File(['pdf content'], 'test.pdf', { type: 'application/pdf' });
      const txtFile = new File(['text content'], 'test.txt', { type: 'text/plain' });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(pdfFile);
      dataTransfer.items.add(txtFile);
      const files = dataTransfer.files;
      
      // Call handleFileUpload
      await act(async () => {
        await result.current.handleFileUpload(files);
      });
      
      // Console warning should be called for non-PDF file
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('is not a PDF and was skipped')
      );
      
      // addPDF should be called once for the PDF file only
      expect(addPDF).toHaveBeenCalledTimes(1);
      expect(addPDF).toHaveBeenCalledWith(expect.objectContaining({
        name: 'test.pdf',
        classId: 'class-1'
      }));
      
      // Alert should be called about skipped files
      expect(global.alert).toHaveBeenCalledWith(
        expect.stringContaining('1 PDF(s) uploaded. 1 non-PDFs skipped')
      );
      
      // refreshData should be called
      expect(mockRefreshData).toHaveBeenCalledTimes(1);
    });

    test('handles errors during file processing', async () => {
      const { result } = renderHook(() => usePDFOperations(defaultProps));
      
      // Create a PDF file
      const pdfFile = new File(['pdf content'], 'test.pdf', { type: 'application/pdf' });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(pdfFile);
      const files = dataTransfer.files;
      
      // Mock arrayBuffer to throw an error
      const arrayBufferSpy = vi.spyOn(File.prototype, 'arrayBuffer')
        .mockRejectedValue(new Error('File read error'));
      
      // Call handleFileUpload
      await act(async () => {
        await result.current.handleFileUpload(files);
      });
      
      // Console error should be called
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error processing file'),
        expect.any(Error)
      );
      
      // Alert should be called about failed uploads
      expect(global.alert).toHaveBeenCalledWith(
        expect.stringContaining('1 PDF(s) failed')
      );
      
      // isProcessing should be set back to false
      expect(result.current.isProcessing).toBe(false);
      
      // Clean up
      arrayBufferSpy.mockRestore();
    });
  });

  describe('handleStatusChange', () => {
    test('updates PDF status locally and in database', async () => {
      const { result } = renderHook(() => usePDFOperations(defaultProps));
      
      // Call handleStatusChange
      await act(async () => {
        await result.current.handleStatusChange(1, 'done');
      });
      
      // setPdfs should be called to update local state
      expect(mockSetPdfs).toHaveBeenCalledTimes(1);
      
      // updatePDFStatus should be called
      expect(updatePDFStatus).toHaveBeenCalledWith(1, 'done');
      
      // refreshData should be called
      expect(mockRefreshData).toHaveBeenCalledTimes(1);
      
    });

    test('updates viewingPDF if it matches the updated PDF', async () => {
      const { result } = renderHook(() => usePDFOperations({
        ...defaultProps,
        viewingPDF: mockPDFs[0]
      }));
      
      // Ensure PDF ID is a number
      const pdfId = mockPDFs[0].id;
      if (pdfId === undefined) {
        throw new Error('PDF ID is undefined');
      }
      
      // Simulate a status change for a PDF
      await act(async () => {
        await result.current.handleStatusChange(pdfId, 'done');
      });
      
      // setViewingPDF should be called to update the viewing PDF
      expect(mockSetViewingPDF).toHaveBeenCalledTimes(1);
      const mockCall = mockSetViewingPDF.mock.calls[0][0];
      expect(typeof mockCall).toBe('function');
      const updatedPDF = mockCall(mockPDFs[0]);
      expect(updatedPDF).toEqual(expect.objectContaining({ id: 1, status: 'done' }));
    });

    test('handles errors during status update', async () => {
      // Mock updatePDFStatus to reject
      (updatePDFStatus as jest.Mock).mockRejectedValueOnce(new Error('DB error'));
      
      const { result } = renderHook(() => usePDFOperations(defaultProps));
      
      // Call handleStatusChange
      await act(async () => {
        await result.current.handleStatusChange(1, 'done');
      });
      
      // Console error should be called
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error updating PDF status:',
        expect.any(Error)
      );
      
      // refreshData should still be called to restore correct state
      expect(mockRefreshData).toHaveBeenCalledWith(true);
      
      // isProcessing should be set back to false
      expect(result.current.isProcessing).toBe(false);
    });
  });

  describe('handleDeletePDF', () => {
    test('deletes PDF locally and from database', async () => {
      const { result } = renderHook(() => usePDFOperations(defaultProps));
      
      // Call handleDeletePDF
      await act(async () => {
        await result.current.handleDeletePDF(1);
      });
      
      // setPdfs should be called to update local state
      expect(mockSetPdfs).toHaveBeenCalledTimes(1);
      
      // deletePDF should be called
      expect(deletePDF).toHaveBeenCalledWith(1);
      
      // refreshData should be called
      expect(mockRefreshData).toHaveBeenCalledWith(true);
      
      // isProcessing should be set back to false
      expect(result.current.isProcessing).toBe(false);
    });

    test('clears viewingPDF if it matches the deleted PDF', async () => {
      const viewingPDF = { ...mockPDFs[0] };
      
      const { result } = renderHook(() => 
        usePDFOperations({
          ...defaultProps,
          viewingPDF
        })
      );
      
      // Call handleDeletePDF
      await act(async () => {
        await result.current.handleDeletePDF(1);
      });
      
      // setViewingPDF should be called with null
      expect(mockSetViewingPDF).toHaveBeenCalledWith(null);
    });

    test('handles errors during PDF deletion', async () => {
      // Mock deletePDF to reject
      (deletePDF as jest.Mock).mockRejectedValueOnce(new Error('DB error'));
      
      const { result } = renderHook(() => usePDFOperations(defaultProps));
      
      // Call handleDeletePDF
      await act(async () => {
        await result.current.handleDeletePDF(1);
      });
      
      // Console error should be called
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error deleting PDF:',
        expect.any(Error)
      );
      
      // refreshData should still be called to restore correct state
      expect(mockRefreshData).toHaveBeenCalledWith(true);
      
      // isProcessing should be set back to false
      expect(result.current.isProcessing).toBe(false);
    });
  });

  describe('handlePDFOrderChange', () => {
    test('does nothing if no class is selected', async () => {
      const { result } = renderHook(() => 
        usePDFOperations({
          ...defaultProps,
          selectedClassId: null
        })
      );
      
      // Call handlePDFOrderChange
      await act(async () => {
        await result.current.handlePDFOrderChange([mockPDFs[1], mockPDFs[0]]);
      });
      
      // setPdfs should not be called
      expect(mockSetPdfs).not.toHaveBeenCalled();
      
      // updateMultiplePDFOrders should not be called
      expect(updateMultiplePDFOrders).not.toHaveBeenCalled();
    });

    test('updates PDF order for to-study tab', async () => {
      const { result } = renderHook(() => usePDFOperations(defaultProps));
      
      // Create reordered PDFs for the to-study tab
      const reorderedPDFs = [mockPDFs[1], mockPDFs[0]]; // Both are to-study
      
      // Call handlePDFOrderChange
      await act(async () => {
        await result.current.handlePDFOrderChange(reorderedPDFs);
      });
      
      // setPdfs should be called to update local state
      expect(mockSetPdfs).toHaveBeenCalledTimes(1);
      
      // updateMultiplePDFOrders should be called with the correct order updates
      expect(updateMultiplePDFOrders).toHaveBeenCalledWith([
        { id: 2, orderIndex: 0 },
        { id: 1, orderIndex: 1 },
        { id: 3, orderIndex: 2 } // done PDF should be included but not reordered
      ]);
      
      // refreshData should be called
      expect(mockRefreshData).toHaveBeenCalledWith(true);
      
      // isProcessing should be set back to false
      expect(result.current.isProcessing).toBe(false);
    });

    test('updates PDF order for done tab', async () => {
      const { result } = renderHook(() => usePDFOperations(defaultProps));
      
      // Create a done PDF to reorder
      const donePDF = { ...mockPDFs[2], id: 4, name: 'PDF 4.pdf' };
      const updatedMockPDFs = [...mockPDFs, donePDF];
      
      // Rerender with updated PDFs
      renderHook(() => 
        usePDFOperations({
          ...defaultProps,
          pdfs: updatedMockPDFs
        })
      );
      
      // Create reordered PDFs for the done tab
      const reorderedDonePDFs = [donePDF, mockPDFs[2]]; // Both are done
      
      // Call handlePDFOrderChange
      await act(async () => {
        await result.current.handlePDFOrderChange(reorderedDonePDFs);
      });
      
      // updateMultiplePDFOrders should be called with the correct order updates
      expect(updateMultiplePDFOrders).toHaveBeenCalledWith(expect.arrayContaining([
        { id: 1, orderIndex: expect.any(Number) },
        { id: 2, orderIndex: expect.any(Number) },
        { id: 3, orderIndex: expect.any(Number) },
        { id: 4, orderIndex: expect.any(Number) }
      ]));
    });

    test('handles errors during order update', async () => {
      // Mock updateMultiplePDFOrders to reject
      (updateMultiplePDFOrders as jest.Mock).mockRejectedValueOnce(new Error('DB error'));
      
      const { result } = renderHook(() => usePDFOperations(defaultProps));
      
      // Call handlePDFOrderChange
      await act(async () => {
        await result.current.handlePDFOrderChange([mockPDFs[1], mockPDFs[0]]);
      });
      
      // Console error should be called
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error updating PDF order:',
        expect.any(Error)
      );
      
      // refreshData should still be called to restore correct state
      expect(mockRefreshData).toHaveBeenCalledWith(true);
      
      // isProcessing should be set back to false
      expect(result.current.isProcessing).toBe(false);
    });
  });

  // Clean up mocks
  afterAll(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });
});
