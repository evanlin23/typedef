// Original path: __tests__/hooks/useClassData.test.ts
// src/__tests__/hooks/useClassData.test.ts
import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, expect } from 'vitest';
import { useClassData } from '../../hooks/useClassData';
import { getClass, getClassPDFs } from '../../utils/db';
import type { Class, PDF } from '../../utils/types';

vi.mock('../../utils/db', () => ({
  getClass: vi.fn(),
  getClassPDFs: vi.fn()
}));

describe('useClassData Hook', () => {
  const mockClass: Class = {
    id: 'class-1', name: 'Test Class', dateCreated: Date.now(), isPinned: false, pdfCount: 2, doneCount: 1, notes: '', progress: 50, completedItems: 1, totalItems: 2
  };
  const mockPDFs: PDF[] = [
    { id: 1, name: 'PDF 1', dateAdded: Date.now() - 1000, size: 1024, lastModified: Date.now() - 1000, data: new ArrayBuffer(0), status: 'to-study' as const, classId: 'class-1', orderIndex: 0 },
    { id: 2, name: 'PDF 2', dateAdded: Date.now() - 2000, size: 2048, lastModified: Date.now() - 2000, data: new ArrayBuffer(0), status: 'done' as const, classId: 'class-1', orderIndex: 1 }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getClass).mockResolvedValue(mockClass);
    vi.mocked(getClassPDFs).mockResolvedValue(mockPDFs);
  });

  test('initializes with null values when classId is null', () => {
    const { result } = renderHook(() => useClassData(true, null));
    expect(result.current.selectedClass).toBe(null);
    expect(result.current.pdfs).toEqual([]);
    expect(result.current.isLoadingClassData).toBe(false);
    expect(result.current.classDataError).toBe(null);
  });

  test('initializes with null values when classId is an empty string', () => {
    const { result } = renderHook(() => useClassData(true, ''));
    expect(result.current.selectedClass).toBe(null);
    expect(result.current.pdfs).toEqual([]);
    expect(result.current.isLoadingClassData).toBe(false);
    expect(result.current.classDataError).toBe(null);
  });


  test('loads class data when classId is provided and DB is initialized', async () => {
    const { result } = renderHook(() => useClassData(true, 'class-1'));

    // Loading state might flip quickly, so waitFor is safer
    await waitFor(() => expect(result.current.isLoadingClassData).toBe(true), { timeout: 100 });

    await waitFor(() => {
      expect(result.current.isLoadingClassData).toBe(false);
      expect(result.current.selectedClass).toEqual(mockClass);
      expect(result.current.pdfs).toEqual(mockPDFs);
      expect(result.current.classDataError).toBe(null);
    });

    expect(getClass).toHaveBeenCalledWith('class-1');
    expect(getClassPDFs).toHaveBeenCalledWith('class-1');
  });

  test('does not load data when DB is not initialized', () => {
    const { result } = renderHook(() => useClassData(false, 'class-1'));
    expect(result.current.isLoadingClassData).toBe(false);
    expect(getClass).not.toHaveBeenCalled();
    expect(result.current.selectedClass).toBeNull();
  });

  test('handles class not found (getClass returns undefined/null)', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(getClass).mockResolvedValue(undefined); // Ensure it resolves to undefined

    const { result } = renderHook(() => useClassData(true, 'not-found-id'));

    await waitFor(() => expect(result.current.isLoadingClassData).toBe(false));

    expect(result.current.selectedClass).toBe(null);
    expect(result.current.pdfs).toEqual([]);
    expect(result.current.classDataError).toBeInstanceOf(Error);
    expect(result.current.classDataError?.message).toBe('Class with ID not-found-id not found.');
    expect(consoleWarnSpy).toHaveBeenCalledWith('Class with ID not-found-id not found during refresh.');
    expect(getClassPDFs).not.toHaveBeenCalled();
    consoleWarnSpy.mockRestore();
  });

  test('handles error during data loading (getClass rejects)', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const mockError = new Error('Database fetch error');
    vi.mocked(getClass).mockRejectedValue(mockError);

    const { result } = renderHook(() => useClassData(true, 'error-id'));

    await waitFor(() => expect(result.current.isLoadingClassData).toBe(false));

    expect(result.current.selectedClass).toBe(null);
    expect(result.current.pdfs).toEqual([]);
    expect(result.current.classDataError).toBe(mockError);
    expect(consoleErrorSpy).toHaveBeenCalledWith('Error loading data for class ID error-id:', mockError);
    consoleErrorSpy.mockRestore();
  });

  test('clears data when classId changes to null', async () => {
    const { result, rerender } = renderHook(({ id }) => useClassData(true, id), {
      initialProps: { id: 'class-1' as string | null }
    });
    await waitFor(() => expect(result.current.isLoadingClassData).toBe(false));
    expect(result.current.selectedClass).not.toBeNull();

    rerender({ id: null });

    await waitFor(() => {
      expect(result.current.selectedClass).toBe(null);
      expect(result.current.pdfs).toEqual([]);
      expect(result.current.classDataError).toBe(null);
    });
  });

  test('refreshData function works correctly when classId is set', async () => {
    const { result } = renderHook(() => useClassData(true, 'class-1'));
    await waitFor(() => expect(result.current.isLoadingClassData).toBe(false)); // Initial load

    vi.clearAllMocks(); // Clear after initial load
    vi.mocked(getClass).mockResolvedValue(mockClass); // Ensure mock is set for refresh
    vi.mocked(getClassPDFs).mockResolvedValue(mockPDFs);

    await act(async () => {
      await result.current.refreshData();
    });

    await waitFor(() => expect(result.current.isLoadingClassData).toBe(false));
    expect(getClass).toHaveBeenCalledTimes(1);
    expect(getClassPDFs).toHaveBeenCalledTimes(1);
  });

  test('refreshData does nothing if classId is null', async () => {
    const { result } = renderHook(() => useClassData(true, null));
    vi.clearAllMocks();
    await act(async () => {
      await result.current.refreshData();
    });
    expect(getClass).not.toHaveBeenCalled();
    expect(result.current.isLoadingClassData).toBe(false);
  });

  test('refreshData with keepLoadingState=true', async () => {
    const { result } = renderHook(() => useClassData(true, 'class-1'));
    await waitFor(() => expect(result.current.isLoadingClassData).toBe(false));
    vi.clearAllMocks();
    vi.mocked(getClass).mockResolvedValue(mockClass);
    vi.mocked(getClassPDFs).mockResolvedValue(mockPDFs);

    await act(async () => {
      await result.current.refreshData(true);
    });
    expect(getClass).toHaveBeenCalledWith('class-1');
    expect(result.current.isLoadingClassData).toBe(false); // Should remain false
  });
});