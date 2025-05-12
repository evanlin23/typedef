// src/hooks/useDBInitialization.ts
import { useEffect, useState } from 'react';
import { initDB } from '../utils/db';

/**
 * Return type for the useDBInitialization hook
 */
interface DBInitializationResult {
  /** Whether the database has been successfully initialized */
  isDBInitialized: boolean;
  /** Error that occurred during database initialization, if any */
  dbError: Error | null;
  /** Whether database initialization is in progress */
  isInitializing: boolean;
}

/**
 * Hook for initializing the IndexedDB database
 * 
 * This hook handles the initialization of the database when the component mounts,
 * and provides state for tracking initialization status and errors.
 * 
 * @returns Object containing database initialization state
 */
export function useDBInitialization(): DBInitializationResult {
  // Track whether the database has been initialized
  const [isDBInitialized, setIsDBInitialized] = useState(false);
  // Track any errors that occur during initialization
  const [dbError, setDbError] = useState<Error | null>(null);
  // Track whether initialization is in progress
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    /**
     * Initialize the database and update state accordingly
     */
    const setupDatabase = async (): Promise<void> => {
      // Set initial state
      setIsInitializing(true);
      setDbError(null);
      
      try {
        // Initialize the database
        await initDB();
        setIsDBInitialized(true);
      } catch (error) {
        // Handle initialization errors
        console.error('Failed to initialize database:', error);
        setDbError(error instanceof Error ? error : new Error(String(error)));
        setIsDBInitialized(false);
      } finally {
        // Always mark initialization as complete
        setIsInitializing(false);
      }
    };
    
    // Run database setup when the component mounts
    setupDatabase();
  }, []);

  return { isDBInitialized, dbError, isInitializing };
}