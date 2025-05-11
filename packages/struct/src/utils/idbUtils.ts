// src/utils/idbUtils.ts
export function idbRequestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = (event) => reject((event.target as IDBRequest).error || new Error('IDBRequest failed'));
  });
}

export function idbTransactionToPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    // Pass the actual IDBTransaction's error object
    transaction.onerror = (event) => reject((event.target as IDBTransaction).error || new Error('IDBTransaction failed'));
    transaction.onabort = (event) => reject((event.target as IDBTransaction).error || new Error('IDBTransaction aborted'));
  });
}