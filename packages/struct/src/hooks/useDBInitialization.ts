// src/hooks/useDBInitialization.ts
import { useEffect, useState } from 'react';
import { initDB } from '../utils/db';

export function useDBInitialization() {
  const [isDBInitialized, setIsDBInitialized] = useState(false);
  const [dbError, setDbError] = useState<Error | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const setupDatabase = async () => {
      setIsInitializing(true);
      setDbError(null);
      try {
        await initDB();
        setIsDBInitialized(true);
      } catch (error) {
        console.error('Failed to initialize database:', error);
        setDbError(error instanceof Error ? error : new Error(String(error)));
        setIsDBInitialized(false);
      } finally {
        setIsInitializing(false);
      }
    };
    setupDatabase();
  }, []);

  return { isDBInitialized, dbError, isInitializing };
}