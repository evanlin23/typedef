// Original path: __tests__/utils/idbUtils.test.ts
import { describe, test, expect } from 'vitest';
import { idbRequestToPromise, idbTransactionToPromise } from '../../utils/idbUtils';

describe('IndexedDB Utility Functions', () => {
  describe('idbRequestToPromise', () => {
    test('resolves with request result on success', async () => {
      // Mock IDBRequest
      const mockRequest = {
        result: 'test-result',
        onsuccess: null as (() => void) | null,
        onerror: null as ((event: Event) => void) | null,
      };

      // Create promise
      const promise = idbRequestToPromise(mockRequest as unknown as IDBRequest);
      
      // Trigger success
      if (mockRequest.onsuccess) mockRequest.onsuccess();
      
      // Check result
      const result = await promise;
      expect(result).toBe('test-result');
    });

    test('rejects with error on failure', async () => {
      // Mock IDBRequest
      const mockError = new Error('Test error');
      const mockRequest = {
        error: mockError,
        onsuccess: null as (() => void) | null,
        onerror: null as ((event: Event) => void) | null,
      };

      // Create promise
      const promise = idbRequestToPromise(mockRequest as unknown as IDBRequest);
      
      // Trigger error
      const mockEvent = { target: mockRequest } as unknown as Event;
      if (mockRequest.onerror) mockRequest.onerror(mockEvent);
      
      // Check rejection
      await expect(promise).rejects.toBe(mockError);
    });

    test('rejects with generic error if no error object is available', async () => {
      // Mock IDBRequest without error property
      const mockRequest = {
        onsuccess: null as (() => void) | null,
        onerror: null as ((event: Event) => void) | null,
      };

      // Create promise
      const promise = idbRequestToPromise(mockRequest as unknown as IDBRequest);
      
      // Trigger error
      const mockEvent = { target: mockRequest } as unknown as Event;
      if (mockRequest.onerror) mockRequest.onerror(mockEvent);
      
      // Check rejection
      await expect(promise).rejects.toThrow('IDBRequest failed');
    });
  });

  describe('idbTransactionToPromise', () => {
    test('resolves on transaction complete', async () => {
      // Mock IDBTransaction
      const mockTransaction = {
        oncomplete: null as (() => void) | null,
        onerror: null as ((event: Event) => void) | null,
        onabort: null as ((event: Event) => void) | null,
        error: null as DOMException | null,
      };

      // Create promise
      const promise = idbTransactionToPromise(mockTransaction as unknown as IDBTransaction);
      
      // Trigger complete
      if (mockTransaction.oncomplete) mockTransaction.oncomplete();
      
      // Check resolution
      await expect(promise).resolves.toBeUndefined();
    });

    test('rejects with error on transaction error', async () => {
      // Mock IDBTransaction
      const mockError = new Error('Transaction error');
      const mockTransaction = {
        error: mockError as DOMException,
        oncomplete: null as (() => void) | null,
        onerror: null as ((event: Event) => void) | null,
        onabort: null as ((event: Event) => void) | null,
      };

      // Create promise
      const promise = idbTransactionToPromise(mockTransaction as unknown as IDBTransaction);
      
      // Trigger error
      const mockEvent = { target: mockTransaction } as unknown as Event;
      if (mockTransaction.onerror) mockTransaction.onerror(mockEvent);
      
      // Check rejection
      await expect(promise).rejects.toBe(mockError);
    });

    test('rejects with error on transaction abort', async () => {
      // Mock IDBTransaction
      const mockError = new Error('Transaction aborted');
      const mockTransaction = {
        error: mockError as DOMException,
        oncomplete: null as (() => void) | null,
        onerror: null as ((event: Event) => void) | null,
        onabort: null as ((event: Event) => void) | null,
      };

      // Create promise
      const promise = idbTransactionToPromise(mockTransaction as unknown as IDBTransaction);
      
      // Trigger abort
      const mockEvent = { target: mockTransaction } as unknown as Event;
      if (mockTransaction.onabort) mockTransaction.onabort(mockEvent);
      
      // Check rejection
      await expect(promise).rejects.toBe(mockError);
    });

    test('rejects with generic error if no error object is available on transaction error', async () => {
      // Mock IDBTransaction without error property
      const mockTransaction = {
        oncomplete: null as (() => void) | null,
        onerror: null as ((event: Event) => void) | null,
        onabort: null as ((event: Event) => void) | null,
        error: null as DOMException | null,
      };

      // Create promise
      const promise = idbTransactionToPromise(mockTransaction as unknown as IDBTransaction);
      
      // Trigger error
      const mockEvent = { target: mockTransaction } as unknown as Event;
      if (mockTransaction.onerror) mockTransaction.onerror(mockEvent);
      
      // Check rejection
      await expect(promise).rejects.toThrow('IDBTransaction failed');
    });

    test('rejects with generic error if no error object is available on transaction abort', async () => {
      // Mock IDBTransaction without error property
      const mockTransaction = {
        oncomplete: null as (() => void) | null,
        onerror: null as ((event: Event) => void) | null,
        onabort: null as ((event: Event) => void) | null,
        error: null as DOMException | null,
      };

      // Create promise
      const promise = idbTransactionToPromise(mockTransaction as unknown as IDBTransaction);
      
      // Trigger abort
      const mockEvent = { target: mockTransaction } as unknown as Event;
      if (mockTransaction.onabort) mockTransaction.onabort(mockEvent);
      
      // Check rejection
      await expect(promise).rejects.toThrow('IDBTransaction aborted');
    });
  });
});