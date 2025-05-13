// Original path: __tests__/hooks/useClassNotes.test.ts
// Original path: __tests__/hooks/useClassNotes.test.ts
// src/__tests__/hooks/useClassNotes.test.ts
import { renderHook, act } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import { useClassNotes } from '../../hooks/useClassNotes';
import { updateClass as actualUpdateClass } from '../../utils/db'; // Import actual for mocking
import type { Class } from '../../utils/types';

// Mock the db utility
vi.mock('../../utils/db', () => ({
  updateClass: vi.fn().mockResolvedValue(undefined)
}));

// Mock setTimeout and clearTimeout
vi.useFakeTimers();
const mockedUpdateClass = vi.mocked(actualUpdateClass);

describe('useClassNotes Hook', () => {
  const mockClass: Class = {
    id: 'class-1',
    name: 'Test Class',
    dateCreated: Date.now(),
    isPinned: false,
    pdfCount: 3,
    doneCount: 1,
    notes: 'Initial notes'
  };

  const mockSetSelectedClass = vi.fn();

  const defaultProps = {
    selectedClass: mockClass,
    setSelectedClass: mockSetSelectedClass,
    selectedClassId: 'class-1'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers(); // Clear any pending timers
  });

  afterEach(() => {
    vi.useRealTimers(); // Restore real timers after tests using fake ones
  });


  test('initializes correctly', () => {
    vi.useRealTimers(); // Don't need fake timers for this one
    const { result } = renderHook(() => useClassNotes(defaultProps));

    // Check if the hook returns the expected function
    expect(result.current.handleClassNotesChange).toBeDefined();
    expect(typeof result.current.handleClassNotesChange).toBe('function');
  });

  test('updates local state immediately when notes change', () => {
    vi.useRealTimers(); // Don't need fake timers for this one
    const { result } = renderHook(() => useClassNotes(defaultProps));

    // Call handleClassNotesChange
    act(() => {
      result.current.handleClassNotesChange('New notes');
    });

    // Check if setSelectedClass was called with updated notes
    expect(mockSetSelectedClass).toHaveBeenCalledTimes(1);
    expect(mockSetSelectedClass).toHaveBeenCalledWith(expect.any(Function));

    // Call the function passed to setSelectedClass to verify it updates notes correctly
    const updateFunction = mockSetSelectedClass.mock.calls[0][0];
    const updatedClass = updateFunction(mockClass);
    expect(updatedClass).toEqual({
      ...mockClass,
      notes: 'New notes'
    });
  });

  test('debounces database updates', async () => {
    vi.useFakeTimers(); // Use fake timers for this test
    const { result } = renderHook(() => useClassNotes(defaultProps));

    // Call handleClassNotesChange multiple times in quick succession
    act(() => {
      result.current.handleClassNotesChange('Notes 1');
      result.current.handleClassNotesChange('Notes 2');
      result.current.handleClassNotesChange('Notes 3');
    });

    // updateClass should not be called yet (before timeout)
    expect(mockedUpdateClass).not.toHaveBeenCalled();

    // Fast-forward timers past the debounce threshold
    await act(async () => {
      vi.advanceTimersByTime(1000); // Advance by more than debounce time (750ms)
      await Promise.resolve(); // Allow any microtasks (like promise resolutions) to settle
    });

    // updateClass should be called once with the latest notes
    expect(mockedUpdateClass).toHaveBeenCalledTimes(1);
    expect(mockedUpdateClass).toHaveBeenCalledWith('class-1', { notes: 'Notes 3' });
  });


  test('does not update database if selectedClassId is null', async () => {
    vi.useFakeTimers(); // Use fake timers
    const { result } = renderHook(() =>
      useClassNotes({
        ...defaultProps,
        selectedClassId: null
      })
    );

    // Call handleClassNotesChange
    act(() => {
      result.current.handleClassNotesChange('New notes');
    });

    // Fast-forward timers
    await act(async () => {
      vi.runAllTimers();
      await Promise.resolve(); // Allow promises to settle
    });


    // updateClass should not be called
    expect(mockedUpdateClass).not.toHaveBeenCalled();
  });

  test('does not update local state if selectedClass id does not match currentSelectedClassId', () => {
    vi.useRealTimers(); // No fake timers needed
    const { result } = renderHook(() =>
      useClassNotes({
        ...defaultProps,
        selectedClassId: 'different-class-id'
      })
    );

    // Call handleClassNotesChange
    act(() => {
      result.current.handleClassNotesChange('New notes');
    });

    // setSelectedClass should not be called
    expect(mockSetSelectedClass).not.toHaveBeenCalled();
  });

  test('cleans up timeout on unmount', () => {
    vi.useFakeTimers(); // Use fake timers
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

    const { result, unmount } = renderHook(() => useClassNotes(defaultProps));

    // Call handleClassNotesChange to set up a timeout
    act(() => {
      result.current.handleClassNotesChange('New notes');
    });

    // Unmount the hook
    unmount();

    // clearTimeout should be called
    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore(); // Restore spy
  });

  test('handles errors when saving notes to DB', async () => {
    vi.useFakeTimers(); // Use fake timers
    // Mock console.error
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Mock updateClass to reject
    mockedUpdateClass.mockRejectedValueOnce(new Error('DB error'));

    const { result } = renderHook(() => useClassNotes(defaultProps));

    // Call handleClassNotesChange
    act(() => {
      result.current.handleClassNotesChange('New notes');
    });

    // Fast-forward timers and wait for promises
    await act(async () => {
      vi.runAllTimers(); // Use runAllTimers to execute the setTimeout callback
      await Promise.resolve(); // Allow the promise from saveNotesToDB to potentially resolve/reject
    });


    // console.error should be called with the error
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to save class notes to DB:',
      expect.any(Error)
    );

    // Restore console.error
    consoleErrorSpy.mockRestore();
  });
});