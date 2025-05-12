import { describe, test, expect } from 'vitest';
import { idbRequestToPromise, idbTransactionToPromise } from '../../utils/idbUtils';

describe('IndexedDB Utility Functions', () => {
  describe('idbRequestToPromise', () => {
    test('resolves with request result on success', async () => {
      // Mock IDBRequest
      const mockRequest = {
        result: 'test-result',
        onsuccess: null as any,
        onerror: null as any
      };

      // Create promise
      const promise = idbRequestToPromise(mockRequest as unknown as IDBRequest);
      
      // Trigger success
      mockRequest.onsuccess();
      
      // Check result
      const result = await promise;
      expect(result).toBe('test-result');
    });

    test('rejects with error on failure', async () => {
      // Mock IDBRequest
      const mockError = new Error('Test error');
      const mockRequest = {
        error: mockError,
        onsuccess: null as any,
        onerror: null as any
      };

      // Create promise
      const promise = idbRequestToPromise(mockRequest as unknown as IDBRequest);
      
      // Trigger error
      const mockEvent = { target: mockRequest };
      mockRequest.onerror(mockEvent);
      
      // Check rejection
      await expect(promise).rejects.toBe(mockError);
    });

    test('rejects with generic error if no error object is available', async () => {
      // Mock IDBRequest without error property
      const mockRequest = {
        onsuccess: null as any,
        onerror: null as any
      };

      // Create promise
      const promise = idbRequestToPromise(mockRequest as unknown as IDBRequest);
      
      // Trigger error
      const mockEvent = { target: mockRequest };
      mockRequest.onerror(mockEvent);
      
      // Check rejection
      await expect(promise).rejects.toThrow('IDBRequest failed');
    });
  });

  describe('idbTransactionToPromise', () => {
    test('resolves on transaction complete', async () => {
      // Mock IDBTransaction
      const mockTransaction = {
        oncomplete: null as any,
        onerror: null as any,
        onabort: null as any
      };

      // Create promise
      const promise = idbTransactionToPromise(mockTransaction as unknown as IDBTransaction);
      
      // Trigger complete
      mockTransaction.oncomplete();
      
      // Check resolution
      await expect(promise).resolves.toBeUndefined();
    });

    test('rejects with error on transaction error', async () => {
      // Mock IDBTransaction
      const mockError = new Error('Transaction error');
      const mockTransaction = {
        error: mockError,
        oncomplete: null as any,
        onerror: null as any,
        onabort: null as any
      };

      // Create promise
      const promise = idbTransactionToPromise(mockTransaction as unknown as IDBTransaction);
      
      // Trigger error
      const mockEvent = { target: mockTransaction };
      mockTransaction.onerror(mockEvent);
      
      // Check rejection
      await expect(promise).rejects.toBe(mockError);
    });

    test('rejects with error on transaction abort', async () => {
      // Mock IDBTransaction
      const mockError = new Error('Transaction aborted');
      const mockTransaction = {
        error: mockError,
        oncomplete: null as any,
        onerror: null as any,
        onabort: null as any
      };

      // Create promise
      const promise = idbTransactionToPromise(mockTransaction as unknown as IDBTransaction);
      
      // Trigger abort
      const mockEvent = { target: mockTransaction };
      mockTransaction.onabort(mockEvent);
      
      // Check rejection
      await expect(promise).rejects.toBe(mockError);
    });

    test('rejects with generic error if no error object is available on transaction error', async () => {
      // Mock IDBTransaction without error property
      const mockTransaction = {
        oncomplete: null as any,
        onerror: null as any,
        onabort: null as any
      };

      // Create promise
      const promise = idbTransactionToPromise(mockTransaction as unknown as IDBTransaction);
      
      // Trigger error
      const mockEvent = { target: mockTransaction };
      mockTransaction.onerror(mockEvent);
      
      // Check rejection
      await expect(promise).rejects.toThrow('IDBTransaction failed');
    });

    test('rejects with generic error if no error object is available on transaction abort', async () => {
      // Mock IDBTransaction without error property
      const mockTransaction = {
        oncomplete: null as any,
        onerror: null as any,
        onabort: null as any
      };

      // Create promise
      const promise = idbTransactionToPromise(mockTransaction as unknown as IDBTransaction);
      
      // Trigger abort
      const mockEvent = { target: mockTransaction };
      mockTransaction.onabort(mockEvent);
      
      // Check rejection
      await expect(promise).rejects.toThrow('IDBTransaction aborted');
    });
  });
});
