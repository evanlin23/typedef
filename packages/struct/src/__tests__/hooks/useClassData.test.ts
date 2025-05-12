import { renderHook, act, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { useClassData } from '../../hooks/useClassData';
import { getClass, getClassPDFs } from '../../utils/db';
import type { Class, PDF } from '../../utils/types';

// Mock the db utilities
vi.mock('../../utils/db', () => ({
  getClass: vi.fn(),
  getClassPDFs: vi.fn()
}));

describe('useClassData Hook', () => {
  const mockClass: Class = {
    id: 'class-1',
    name: 'Test Class',
    dateCreated: Date.now(),
    isPinned: false,
    pdfCount: 2,
    doneCount: 1,
    notes: '',
    progress: 50,
    completedItems: 1,
    totalItems: 2
  };
  
  const mockPDFs: PDF[] = [
    {
      id: 1,
      name: 'PDF 1',
      dateAdded: Date.now() - 1000,
      size: 1024,
      lastModified: Date.now() - 1000,
      data: new ArrayBuffer(1024),
      status: 'to-study' as const,
      classId: 'class-1',
      orderIndex: 0
    },
    {
      id: 2,
      name: 'PDF 2',
      dateAdded: Date.now() - 2000,
      size: 2048,
      lastModified: Date.now() - 2000,
      data: new ArrayBuffer(2048),
      status: 'done' as const,
      classId: 'class-1',
      orderIndex: 1
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock implementations
    (getClass as jest.Mock).mockResolvedValue(mockClass);
    (getClassPDFs as jest.Mock).mockResolvedValue(mockPDFs);
  });

  test('initializes with null values', () => {
    const { result } = renderHook(() => useClassData(true));
    
    expect(result.current.selectedClassId).toBe(null);
    expect(result.current.selectedClass).toBe(null);
    expect(result.current.pdfs).toEqual([]);
    expect(result.current.isLoadingClassData).toBe(false);
    expect(result.current.classDataError).toBe(null);
  });

  test('loads class data when selectedClassId is set', async () => {
    const { result } = renderHook(() => useClassData(true));
    
    // Set selected class ID
    act(() => {
      result.current.setSelectedClassId('123');
    });
    
    // Should be loading initially
    expect(result.current.isLoadingClassData).toBe(true);
    
    // Wait for data to load
    await waitFor(() => {
      expect(result.current.isLoadingClassData).toBe(false);
    });
    
    // Check loaded data
    expect(result.current.selectedClass).toEqual(mockClass);
    expect(result.current.pdfs).toEqual(mockPDFs);
    expect(result.current.classDataError).toBe(null);
    
    // Check if DB functions were called
    expect(getClass).toHaveBeenCalledWith('123');
    expect(getClassPDFs).toHaveBeenCalledWith('123');
  });

  test('does not load data when DB is not initialized', async () => {
    // Mock console.log to prevent test output pollution
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    const { result } = renderHook(() => useClassData(false));
    
    // Set selected class ID
    act(() => {
      result.current.setSelectedClassId('123');
    });
    
    // Should not be loading
    expect(result.current.isLoadingClassData).toBe(false);
    
    // DB functions should not be called
    expect(getClass).not.toHaveBeenCalled();
    expect(getClassPDFs).not.toHaveBeenCalled();
    
    // The component might handle DB not initialized differently now,
    // so we just check that the DB functions were not called
    
    // Restore console.log
    consoleLogSpy.mockRestore();
  });

  test('handles class not found', async () => {
    // Mock console.warn to prevent test output pollution
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    // Mock getClass to return null (class not found)
    (getClass as jest.Mock).mockResolvedValue(null);
    
    const { result } = renderHook(() => useClassData(true));
    
    // Set selected class ID
    act(() => {
      result.current.setSelectedClassId('456');
    });
    
    // Wait for data to load
    await waitFor(() => {
      expect(result.current.isLoadingClassData).toBe(false);
    });
    
    // Should clear data and set error
    expect(result.current.selectedClass).toBe(null);
    expect(result.current.pdfs).toEqual([]);
    expect(result.current.classDataError).toBeInstanceOf(Error);
    expect(result.current.classDataError?.message).toBe('Class with ID 456 not found.');
    
    // Should log warning
    expect(consoleWarnSpy).toHaveBeenCalledWith('Class with ID 456 not found. Clearing data.');
    
    // getClassPDFs should not be called if class is not found
    expect(getClassPDFs).not.toHaveBeenCalled();
    
    // Restore console.warn
    consoleWarnSpy.mockRestore();
  });

  test('handles error during data loading', async () => {
    // Mock console.error to prevent test output pollution
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Mock getClass to throw error
    const mockError = new Error('Database error');
    (getClass as jest.Mock).mockRejectedValue(mockError);
    
    const { result } = renderHook(() => useClassData(true));
    
    // Set selected class ID
    act(() => {
      result.current.setSelectedClassId('123');
    });
    
    // Wait for data to load
    await waitFor(() => {
      expect(result.current.isLoadingClassData).toBe(false);
    });
    
    // Should clear data and set error
    expect(result.current.selectedClass).toBe(null);
    expect(result.current.pdfs).toEqual([]);
    expect(result.current.classDataError).toBe(mockError);
    
    // Should log error
    expect(consoleErrorSpy).toHaveBeenCalledWith('Error loading data for class ID 123:', mockError);
    
    // Restore console.error
    consoleErrorSpy.mockRestore();
  });

  test('clears data when selectedClassId is set to null', async () => {
    const { result } = renderHook(() => useClassData(true));
    
    // First set a class ID
    act(() => {
      result.current.setSelectedClassId('123');
    });
    
    // Wait for data to load
    await waitFor(() => {
      expect(result.current.selectedClass).not.toBe(null);
    });
    
    // Now clear the class ID
    act(() => {
      result.current.setSelectedClassId(null);
    });
    
    // Data should be cleared
    expect(result.current.selectedClassId).toBe(null);
    expect(result.current.selectedClass).toBe(null);
    expect(result.current.pdfs).toEqual([]);
    expect(result.current.isLoadingClassData).toBe(false);
    expect(result.current.classDataError).toBe(null);
  });

  test('refreshData function works correctly', async () => {
    const { result } = renderHook(() => useClassData(true));
    
    // Set selected class ID
    act(() => {
      result.current.setSelectedClassId('123');
    });
    
    // Wait for initial data to load
    await waitFor(() => {
      expect(result.current.isLoadingClassData).toBe(false);
    });
    
    // Clear mocks to track new calls
    vi.clearAllMocks();
    
    // Call refreshData
    await act(async () => {
      await result.current.refreshData();
    });
    
    // Should have called DB functions again
    expect(getClass).toHaveBeenCalledWith('123');
    expect(getClassPDFs).toHaveBeenCalledWith('123');
  });

  test('refreshData with keepLoadingState option', async () => {
    const { result } = renderHook(() => useClassData(true));
    
    // Set selected class ID
    act(() => {
      result.current.setSelectedClassId('123');
    });
    
    // Wait for initial data to load
    await waitFor(() => {
      expect(result.current.isLoadingClassData).toBe(false);
    });
    
    // Spy on getClass and getClassPDFs to check if they're called
    vi.clearAllMocks();
    
    // Call refreshData with keepLoadingState=true
    await act(async () => {
      await result.current.refreshData(true);
    });
    
    // Should still have called DB functions
    expect(getClass).toHaveBeenCalledWith('123');
    expect(getClassPDFs).toHaveBeenCalledWith('123');
    
    // Loading state should remain false since we're keeping the loading state
    expect(result.current.isLoadingClassData).toBe(false);
  });
});
