// src/utils/idbUtils.ts
/**
 * Converts an IDBRequest into a Promise
 * @param request The IDBRequest to convert
 * @returns A Promise that resolves with the request result or rejects with the error
 */
export function idbRequestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = (event) => reject((event.target as IDBRequest).error || new Error('IDBRequest failed'));
  });
}

/**
 * Converts an IDBTransaction into a Promise
 * @param transaction The IDBTransaction to convert
 * @returns A Promise that resolves when the transaction completes or rejects with the error
 */
export function idbTransactionToPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = (event) => reject((event.target as IDBTransaction).error || new Error('IDBTransaction failed'));
    transaction.onabort = (event) => reject((event.target as IDBTransaction).error || new Error('IDBTransaction aborted'));
  });
}

/**
 * Creates a transaction and returns the requested object stores
 * @param db The database connection
 * @param storeNames Array of store names to include in the transaction
 * @param mode Transaction mode ('readonly' or 'readwrite')
 * @returns Object containing the transaction and requested stores
 */
export function createTransaction(
  db: IDBDatabase,
  storeNames: string[],
  mode: IDBTransactionMode = 'readonly'
): { transaction: IDBTransaction; stores: Record<string, IDBObjectStore> } {
  const transaction = db.transaction(storeNames, mode);
  
  const stores = storeNames.reduce((acc, storeName) => {
    acc[storeName] = transaction.objectStore(storeName);
    return acc;
  }, {} as Record<string, IDBObjectStore>);
  
  return { transaction, stores };
}

/**
 * Executes an operation within a transaction and handles transaction completion
 * @param db The database connection
 * @param storeNames Array of store names to include in the transaction
 * @param mode Transaction mode
 * @param operation Function that performs operations using the transaction
 * @returns Promise resolving to the operation result
 */
export async function executeTransaction<R>(
  db: IDBDatabase,
  storeNames: string[],
  mode: IDBTransactionMode,
  operation: (stores: Record<string, IDBObjectStore>, transaction: IDBTransaction) => Promise<R>
): Promise<R> {
  const { transaction, stores } = createTransaction(db, storeNames, mode);
  
  try {
    const result = await operation(stores, transaction);
    await idbTransactionToPromise(transaction);
    return result;
  } catch (error) {
    if (!transaction.error) {
      try {
        transaction.abort();
      } catch (abortError) {
        console.warn('Error aborting transaction:', abortError);
      }
    }
    throw error;
  }
}