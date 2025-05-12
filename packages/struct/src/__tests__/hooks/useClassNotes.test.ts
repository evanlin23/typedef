import { renderHook, act } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { useClassNotes } from '../../hooks/useClassNotes';
import { updateClass } from '../../utils/db';
import type { Class } from '../../utils/types';

// Mock the db utility
vi.mock('../../utils/db', () => ({
  updateClass: vi.fn().mockResolvedValue(undefined)
}));

// Mock setTimeout and clearTimeout
vi.useFakeTimers();

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
  });

  test('initializes correctly', () => {
    const { result } = renderHook(() => useClassNotes(defaultProps));
    
    // Check if the hook returns the expected function
    expect(result.current.handleClassNotesChange).toBeDefined();
    expect(typeof result.current.handleClassNotesChange).toBe('function');
  });

  test('updates local state immediately when notes change', () => {
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

  test('debounces database updates', () => {
    const { result } = renderHook(() => useClassNotes(defaultProps));
    
    // Call handleClassNotesChange multiple times in quick succession
    act(() => {
      result.current.handleClassNotesChange('Notes 1');
      result.current.handleClassNotesChange('Notes 2');
      result.current.handleClassNotesChange('Notes 3');
    });
    
    // updateClass should not be called yet (before timeout)
    expect(updateClass).not.toHaveBeenCalled();
    
    // Fast-forward timers
    act(() => {
      vi.runAllTimers();
    });
    
    // updateClass should be called once with the latest notes
    expect(updateClass).toHaveBeenCalledTimes(1);
    expect(updateClass).toHaveBeenCalledWith('class-1', { notes: 'Notes 3' });
  });

  test('does not update database if selectedClassId is null', () => {
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
    act(() => {
      vi.runAllTimers();
    });
    
    // updateClass should not be called
    expect(updateClass).not.toHaveBeenCalled();
  });

  test('does not update local state if selectedClass id does not match currentSelectedClassId', () => {
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
  });

  test('handles errors when saving notes to DB', async () => {
    // Mock console.error
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Mock updateClass to reject
    (updateClass as jest.Mock).mockRejectedValueOnce(new Error('DB error'));
    
    const { result } = renderHook(() => useClassNotes(defaultProps));
    
    // Call handleClassNotesChange
    act(() => {
      result.current.handleClassNotesChange('New notes');
    });
    
    // Fast-forward timers
    act(() => {
      vi.runAllTimers();
    });
    
    // Wait for the promise to resolve
    await vi.runAllTimersAsync();
    
    // console.error should be called with the error
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to save class notes to DB:',
      expect.any(Error)
    );
    
    // Restore console.error
    consoleErrorSpy.mockRestore();
  });
});
