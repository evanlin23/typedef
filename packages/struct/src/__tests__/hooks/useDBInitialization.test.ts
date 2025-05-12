import { renderHook, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { useDBInitialization } from '../../hooks/useDBInitialization';
import { initDB } from '../../utils/db';

// Mock the db utilities
vi.mock('../../utils/db', () => ({
  initDB: vi.fn()
}));

describe('useDBInitialization Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock implementation for successful initialization
    (initDB as jest.Mock).mockResolvedValue(undefined);
  });

  test('initializes database successfully', async () => {
    const { result } = renderHook(() => useDBInitialization());
    
    // Initially should be initializing
    expect(result.current.isInitializing).toBe(true);
    expect(result.current.isDBInitialized).toBe(false);
    expect(result.current.dbError).toBe(null);
    
    // Wait for initialization to complete
    await waitFor(() => {
      expect(result.current.isInitializing).toBe(false);
    });
    
    // Should be initialized with no errors
    expect(result.current.isDBInitialized).toBe(true);
    expect(result.current.dbError).toBe(null);
    
    // initDB should have been called
    expect(initDB).toHaveBeenCalledTimes(1);
  });

  test('handles initialization error', async () => {
    // Mock console.error to prevent test output pollution
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Mock initDB to reject
    const mockError = new Error('Database initialization failed');
    (initDB as jest.Mock).mockRejectedValueOnce(mockError);
    
    const { result } = renderHook(() => useDBInitialization());
    
    // Wait for initialization to complete
    await waitFor(() => {
      expect(result.current.isInitializing).toBe(false);
    });
    
    // Should not be initialized and have an error
    expect(result.current.isDBInitialized).toBe(false);
    expect(result.current.dbError).toEqual(mockError);
    
    // Error should be logged
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to initialize database:', mockError);
    
    // Restore console.error
    consoleErrorSpy.mockRestore();
  });

  test('handles non-Error objects in catch block', async () => {
    // Mock console.error to prevent test output pollution
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Mock initDB to reject with a string
    (initDB as jest.Mock).mockRejectedValueOnce('String error message');
    
    const { result } = renderHook(() => useDBInitialization());
    
    // Wait for initialization to complete
    await waitFor(() => {
      expect(result.current.isInitializing).toBe(false);
    });
    
    // Should not be initialized and have an error
    expect(result.current.isDBInitialized).toBe(false);
    expect(result.current.dbError).toBeInstanceOf(Error);
    expect(result.current.dbError?.message).toBe('String error message');
    
    // Restore console.error
    consoleErrorSpy.mockRestore();
  });
});
