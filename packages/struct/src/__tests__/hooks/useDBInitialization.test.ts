// Original path: __tests__/hooks/useDBInitialization.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { useDBInitialization } from '../../hooks/useDBInitialization';
import { initDB } from '../../utils/db';

// Mock the db utilities
vi.mock('../../utils/db', () => ({
  initDB: vi.fn()
}));

// Create a minimal mock IDBDatabase. Add properties if your code actually uses them.
const mockDbInstance = {
  // Add any IDBDatabase properties your code might interact with, e.g., close: vi.fn()
  // For a simple "did it initialize" check, an empty object cast might be enough.
} as IDBDatabase;


describe('useDBInitialization Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock implementation for successful initialization
    vi.mocked(initDB).mockResolvedValue(mockDbInstance); // Changed to mockDbInstance
  });

  test('initializes database successfully', async () => {
    const { result } = renderHook(() => useDBInitialization());
    
    expect(result.current.isInitializing).toBe(true);
    expect(result.current.isDBInitialized).toBe(false);
    expect(result.current.dbError).toBe(null);
    
    await waitFor(() => {
      expect(result.current.isInitializing).toBe(false);
    });
    
    expect(result.current.isDBInitialized).toBe(true);
    expect(result.current.dbError).toBe(null);
    expect(initDB).toHaveBeenCalledTimes(1);
  });

  test('handles initialization error', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const mockError = new Error('Database initialization failed');
    vi.mocked(initDB).mockRejectedValueOnce(mockError);
    
    const { result } = renderHook(() => useDBInitialization());
    
    await waitFor(() => {
      expect(result.current.isInitializing).toBe(false);
    });
    
    expect(result.current.isDBInitialized).toBe(false);
    expect(result.current.dbError).toEqual(mockError);
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to initialize database:', mockError);
    consoleErrorSpy.mockRestore();
  });

  test('handles non-Error objects in catch block', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(initDB).mockRejectedValueOnce('String error message');
    
    const { result } = renderHook(() => useDBInitialization());
    
    await waitFor(() => {
      expect(result.current.isInitializing).toBe(false);
    });
    
    expect(result.current.isDBInitialized).toBe(false);
    expect(result.current.dbError).toBeInstanceOf(Error);
    expect(result.current.dbError?.message).toBe('String error message');
    consoleErrorSpy.mockRestore();
  });
});