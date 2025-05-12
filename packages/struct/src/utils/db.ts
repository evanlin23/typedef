// src/utils/db.ts
import type { PDF, Class } from './types';
import { idbRequestToPromise, idbTransactionToPromise } from './idbUtils';

const DB_NAME = 'pdf-study-app';
const DB_VERSION = 2;
const PDF_STORE = 'pdfs';
const CLASS_STORE = 'classes';

let dbConnection: IDBDatabase | null = null;

export const initDB = (): Promise<IDBDatabase> => {
  if (dbConnection) {
    return Promise.resolve(dbConnection);
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error('IndexedDB error:', (event.target as IDBOpenDBRequest).error);
      reject((event.target as IDBOpenDBRequest).error || new Error('Error opening database'));
    };

    request.onsuccess = (event) => {
      dbConnection = (event.target as IDBOpenDBRequest).result;
      dbConnection.onclose = () => {
        console.warn('Database connection closed.');
        dbConnection = null;
      };
      dbConnection.onversionchange = () => {
        dbConnection?.close();
        console.warn('Database version change detected. Connection closed.');
        alert('Database is being updated. Please reload the page.');
        dbConnection = null;
      };
      resolve(dbConnection);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const transaction = (event.target as IDBOpenDBRequest).transaction;
      const oldVersion = event.oldVersion;

      if (oldVersion < 1) {
        if (!db.objectStoreNames.contains(PDF_STORE)) {
          const pdfStore = db.createObjectStore(PDF_STORE, { keyPath: 'id', autoIncrement: true });
          pdfStore.createIndex('status', 'status', { unique: false });
          pdfStore.createIndex('dateAdded', 'dateAdded', { unique: false });
        }
      }

      if (oldVersion < 2) {
        if (!db.objectStoreNames.contains(CLASS_STORE)) {
          const classStore = db.createObjectStore(CLASS_STORE, { keyPath: 'id' });
          classStore.createIndex('name', 'name', { unique: false });
          classStore.createIndex('dateCreated', 'dateCreated', { unique: false });
          classStore.createIndex('isPinned', 'isPinned', { unique: false });
        }
        // Ensure transaction exists for modifying pdfStore if DB was just created or version upgraded
        const currentTransaction = transaction || db.transaction(PDF_STORE, 'readwrite');
        const pdfStore = currentTransaction.objectStore(PDF_STORE);
        if (!pdfStore.indexNames.contains('classId')) {
          pdfStore.createIndex('classId', 'classId', { unique: false });
        }
      }
    };
  });
};

const _updateClassCountersInTransaction = async (
  classStore: IDBObjectStore,
  classId: string,
  pdfDelta: number,
  doneDelta: number,
): Promise<void> => {
  const classData = await idbRequestToPromise<Class | undefined>(classStore.get(classId));
  if (classData) {
    const newPdfCount = (classData.pdfCount || 0) + pdfDelta;
    const newDoneCount = (classData.doneCount || 0) + doneDelta;
    const updatedClass = {
      ...classData,
      pdfCount: Math.max(0, newPdfCount),
      doneCount: Math.max(0, newDoneCount),
    };
    await idbRequestToPromise(classStore.put(updatedClass));
  } else {
    console.warn(`Class with id ${classId} not found for counter update.`);
  }
};

export const addClass = async (classData: Omit<Class, 'id' | 'pdfCount' | 'doneCount' | 'notes'>): Promise<string> => {
  const db = await initDB();
  const transaction = db.transaction([CLASS_STORE], 'readwrite');
  const store = transaction.objectStore(CLASS_STORE);
  const newId = crypto.randomUUID();

  const newClass: Class = {
    id: newId,
    ...classData,
    pdfCount: 0,
    doneCount: 0,
    isPinned: classData.isPinned || false,
    notes: '',
  };

  await idbRequestToPromise(store.add(newClass));
  await idbTransactionToPromise(transaction);
  return newId;
};

export const getClasses = async (): Promise<Class[]> => {
  const db = await initDB();
  const transaction = db.transaction([CLASS_STORE], 'readonly');
  const store = transaction.objectStore(CLASS_STORE);
  return idbRequestToPromise<Class[]>(store.getAll());
};

export const getClass = async (id: string): Promise<Class | undefined> => {
  const db = await initDB();
  const transaction = db.transaction([CLASS_STORE], 'readonly');
  const store = transaction.objectStore(CLASS_STORE);
  return idbRequestToPromise<Class | undefined>(store.get(id));
};

export const updateClass = async (id: string, updates: Partial<Omit<Class, 'id'>>): Promise<void> => {
  const db = await initDB();
  const transaction = db.transaction([CLASS_STORE], 'readwrite');
  const store = transaction.objectStore(CLASS_STORE);

  const classData = await idbRequestToPromise<Class | undefined>(store.get(id));
  if (!classData) {
    throw new Error(`Class with ID ${id} not found for update.`);
  }
  const updatedClass = { ...classData, ...updates };

  await idbRequestToPromise(store.put(updatedClass));
  await idbTransactionToPromise(transaction);
};

export const deleteClass = async (id: string): Promise<void> => {
  // console.log(`[db.ts] deleteClass: Starting deletion for class ID: ${id}`);
  const db = await initDB();
  const transaction = db.transaction([CLASS_STORE, PDF_STORE], 'readwrite');
  const classStore = transaction.objectStore(CLASS_STORE);
  const pdfStore = transaction.objectStore(PDF_STORE);
  const pdfClassIndex = pdfStore.index('classId');

  await new Promise<void>((resolveIteration, rejectIteration) => {
    const cursorReq = pdfClassIndex.openCursor(IDBKeyRange.only(id));
    // console.log(`[db.ts] deleteClass: Opened cursor for class ID: ${id}`);

    cursorReq.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
      if (cursor) {
        // console.log(`[db.ts] deleteClass: Found PDF with ID ${cursor.value.id} (key: ${cursor.primaryKey}) for class ${id}. Attempting delete.`);
        const deletePdfRequest = cursor.delete();

        new Promise<void>((resolveDelete, rejectDelete) => {
          deletePdfRequest.onsuccess = () => {
            // console.log(`[db.ts] deleteClass: Successfully deleted PDF with key ${cursor.primaryKey}.`);
            resolveDelete();
          };
          deletePdfRequest.onerror = (e) => {
            console.error(`[db.ts] deleteClass: Error deleting PDF with key ${cursor.primaryKey}:`, (e.target as IDBRequest).error);
            rejectDelete((e.target as IDBRequest).error);
          };
        })
        .then(() => {
          cursor.continue();
        })
        .catch(err => {
          // console.error(`[db.ts] deleteClass: Catching error from PDF delete promise for class ${id}. Aborting transaction.`, err);
          if (!transaction.error) { // Check if transaction already has an error
            try { transaction.abort(); } catch (abortErr) { console.warn("Error aborting transaction in deleteClass PDFs loop:", abortErr); }
          }
          rejectIteration(err);
        });
      } else {
        // console.log(`[db.ts] deleteClass: No more PDFs found for class ID: ${id}. PDF deletion part complete.`);
        resolveIteration();
      }
    };

    cursorReq.onerror = (event) => {
      const error = (event.target as IDBRequest).error;
      console.error(`[db.ts] deleteClass: Error opening/iterating cursor for class ID ${id}:`, error);
      if (!transaction.error) {
         try { transaction.abort(); } catch (abortErr) { console.warn("Error aborting transaction in deleteClass cursor onerror:", abortErr); }
      }
      rejectIteration(error);
    };
  });

  // console.log(`[db.ts] deleteClass: PDF iteration finished for class ID: ${id}. Attempting to delete class object.`);
  const deleteClassReq = classStore.delete(id);
  await idbRequestToPromise(deleteClassReq).catch(err => {
      console.error(`[db.ts] deleteClass: Error during classStore.delete for class ID ${id}:`, err);
      if(!transaction.error) { // Check if transaction already has an error
          try { transaction.abort(); } catch (abortErr) { console.warn("Error aborting transaction in deleteClass class delete catch:", abortErr); }
      }
      throw err;
  });
  // console.log(`[db.ts] deleteClass: Class object for ID ${id} delete request sent.`);

  await idbTransactionToPromise(transaction);
  // console.log(`[db.ts] deleteClass: Transaction completed for class ID: ${id}.`);
};

export const addPDF = async (pdfData: Omit<PDF, 'id'>): Promise<number> => {
  const db = await initDB();
  const transaction = db.transaction([PDF_STORE, CLASS_STORE], 'readwrite');
  const pdfStore = transaction.objectStore(PDF_STORE);
  const classStore = transaction.objectStore(CLASS_STORE);

  const pdfToAdd: Omit<PDF, 'id'> = {
    ...pdfData,
    orderIndex: pdfData.orderIndex
  };

  const addedKey = await idbRequestToPromise(pdfStore.add(pdfToAdd)); // Returns IDBValidKey

  if (typeof addedKey !== 'number') {
    console.error('Error in addPDF: Expected a numeric key from pdfStore.add, but received:', addedKey);
    if (!transaction.error) {
        try { transaction.abort(); } catch (e) { console.warn("Error aborting transaction in addPDF key check:", e); }
    }
    throw new Error('Failed to add PDF: received non-numeric key.');
  }
  const pdfId: number = addedKey;

  await _updateClassCountersInTransaction(classStore, pdfData.classId, 1, 0);
  await idbTransactionToPromise(transaction);
  return pdfId;
};

export const getClassPDFs = async (classId: string): Promise<PDF[]> => {
  const db = await initDB();
  const transaction = db.transaction([PDF_STORE], 'readonly');
  const store = transaction.objectStore(PDF_STORE);
  const index = store.index('classId');
  const pdfs = await idbRequestToPromise<PDF[]>(index.getAll(IDBKeyRange.only(classId))) || [];

  if (pdfs && pdfs.length > 0) {
    pdfs.sort((a, b) => {
      const aHasOrder = a.orderIndex !== undefined && a.orderIndex !== null;
      const bHasOrder = b.orderIndex !== undefined && b.orderIndex !== null;
      if (aHasOrder && bHasOrder) return a.orderIndex! - b.orderIndex!;
      if (aHasOrder) return -1;
      if (bHasOrder) return 1;
      return a.name.localeCompare(b.name);
    });
  }
  return pdfs;
};

export const getPDF = async (id: number): Promise<PDF | undefined> => {
  const db = await initDB();
  const transaction = db.transaction([PDF_STORE], 'readonly');
  const store = transaction.objectStore(PDF_STORE);
  return idbRequestToPromise<PDF | undefined>(store.get(id));
};

export const updatePDFStatus = async (pdfId: number, newStatus: 'to-study' | 'done'): Promise<void> => {
  const db = await initDB();
  const pdf = await getPDF(pdfId);
  if (!pdf) { throw new Error(`PDF with ID ${pdfId} not found.`); }
  if (pdf.status === newStatus) return;

  const transaction = db.transaction([PDF_STORE, CLASS_STORE], 'readwrite');
  const pdfStore = transaction.objectStore(PDF_STORE);
  const classStore = transaction.objectStore(CLASS_STORE);

  // Update the PDF status
  const updatedPDFData = { ...pdf, status: newStatus };
  await idbRequestToPromise(pdfStore.put(updatedPDFData));

  // Calculate the change in done count
  const doneDelta = newStatus === 'done' ? 1 : (pdf.status === 'done' ? -1 : 0);
  if (doneDelta !== 0) {
    await _updateClassCountersInTransaction(classStore, pdf.classId, 0, doneDelta);
  }
  
  await idbTransactionToPromise(transaction);
};

export const deletePDF = async (pdfId: number): Promise<void> => {
  const db = await initDB();
  const pdf = await getPDF(pdfId);
  if (!pdf) {
    console.warn(`PDF with ID ${pdfId} not found for deletion.`);
    return;
  }

  const transaction = db.transaction([PDF_STORE, CLASS_STORE], 'readwrite');
  const pdfStore = transaction.objectStore(PDF_STORE);
  const classStore = transaction.objectStore(CLASS_STORE);

  // Delete the PDF first
  await idbRequestToPromise(pdfStore.delete(pdfId));
  
  // Update class counters
  const doneDelta = pdf.status === 'done' ? -1 : 0;
  await _updateClassCountersInTransaction(classStore, pdf.classId, -1, doneDelta);
  
  await idbTransactionToPromise(transaction);
};

export const updateMultiplePDFOrders = async (updates: Array<{ id: number; orderIndex: number }>): Promise<void> => {
  if (updates.length === 0) return;

  const db = await initDB();
  const transaction = db.transaction([PDF_STORE], 'readwrite');
  const store = transaction.objectStore(PDF_STORE);

  // Process each update in sequence
  for (const update of updates) {
    const pdf = await idbRequestToPromise<PDF | undefined>(store.get(update.id));
    if (pdf) {
      // Create a new object with the updated orderIndex
      const updatedPDF = { ...pdf, orderIndex: update.orderIndex };
      // Update the PDF in the store
      await idbRequestToPromise(store.put(updatedPDF));
    } else {
      console.warn(`PDF with ID ${update.id} not found for order update.`);
    }
  }
  
  // Complete the transaction
  await idbTransactionToPromise(transaction);
};

export const toggleClassPin = async (id: string): Promise<void> => {
  const db = await initDB();
  const transaction = db.transaction([CLASS_STORE], 'readwrite');
  const store = transaction.objectStore(CLASS_STORE);

  const classData = await idbRequestToPromise<Class | undefined>(store.get(id));
  if (!classData) { throw new Error(`Class ${id} not found.`); }

  const updatedClass = { ...classData, isPinned: !classData.isPinned };
  await idbRequestToPromise(store.put(updatedClass));
  await idbTransactionToPromise(transaction);
};

export const getPinnedClasses = async (): Promise<Class[]> => {
  const db = await initDB();
  const transaction = db.transaction([CLASS_STORE], 'readonly');
  const store = transaction.objectStore(CLASS_STORE);
  const index = store.index('isPinned');
  return idbRequestToPromise<Class[]>(index.getAll(IDBKeyRange.only(true as any)));
};

export const getAllPDFs = async (): Promise<PDF[]> => {
  const db = await initDB();
  const transaction = db.transaction([PDF_STORE], 'readonly');
  const store = transaction.objectStore(PDF_STORE);
  return idbRequestToPromise<PDF[]>(store.getAll());
};