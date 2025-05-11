// src/utils/db.ts
import type { PDF, Class } from './types';

const DB_NAME = 'pdf-study-app';
const DB_VERSION = 2; // Ensure this is up-to-date if schema changes like adding indexes occur
const PDF_STORE = 'pdfs';
const CLASS_STORE = 'classes';

let dbConnection: IDBDatabase | null = null;

export const initDB = (): Promise<IDBDatabase> => {
  if (dbConnection) {
    return Promise.resolve(dbConnection);
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (_event) => { // Changed to _event
      console.error('IndexedDB error:', _event); // Optionally log _event
      reject(new Error('Error opening database'));
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
          const classStore = db.createObjectStore(CLASS_STORE, { keyPath: 'id', autoIncrement: true });
          classStore.createIndex('name', 'name', { unique: false });
          classStore.createIndex('dateCreated', 'dateCreated', { unique: false });
          classStore.createIndex('isPinned', 'isPinned', { unique: false }); 
        }
        if (transaction) {
          const pdfStore = transaction.objectStore(PDF_STORE);
          if (!pdfStore.indexNames.contains('classId')) {
            pdfStore.createIndex('classId', 'classId', { unique: false });
          }
        } else {
          console.error('Upgrade transaction not available for PDF store modification.');
        }
      }
    };
  });
};

const _updateClassCountersInTransaction = (
  classStore: IDBObjectStore,
  classId: number,
  pdfDelta: number,
  doneDelta: number,
): Promise<void> => new Promise((resolve, reject) => {
  const getRequest = classStore.get(classId);
  getRequest.onsuccess = () => {
    const classData = getRequest.result as Class | undefined;
    if (classData) {
      const newPdfCount = (classData.pdfCount || 0) + pdfDelta;
      const newDoneCount = (classData.doneCount || 0) + doneDelta;
      const updatedClass = {
        ...classData,
        pdfCount: Math.max(0, newPdfCount),
        doneCount: Math.max(0, newDoneCount),
      };
      const updateRequest = classStore.put(updatedClass);
      updateRequest.onsuccess = () => resolve();
      updateRequest.onerror = (errEvent) => {
        console.error('Error updating class counters:', errEvent); // Log actual event
        reject(new Error('Failed to update class counters.'));
      };
    } else {
      console.warn(`Class with id ${classId} not found for counter update.`);
      resolve(); 
    }
  };
  getRequest.onerror = (errEvent) => {
    console.error('Error fetching class for counter update:', errEvent); // Log actual event
    reject(new Error('Failed to fetch class for counter update.'));
  };
});

export const addClass = async(classData: Omit<Class, 'id' | 'pdfCount' | 'doneCount' | 'notes'>): Promise<number> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([CLASS_STORE], 'readwrite');
    const store = transaction.objectStore(CLASS_STORE);
    transaction.onerror = (_event) => { // Changed to _event
      console.error('Transaction error while adding class:', _event); // Optionally log _event
      reject(new Error('Transaction error while adding class.'));
    };

    const newClass: Omit<Class, 'id'> = { 
      ...classData,
      pdfCount: 0,
      doneCount: 0,
      isPinned: classData.isPinned || false,
      notes: '', 
    };

    const request = store.add(newClass);
    request.onsuccess = () => resolve(request.result as number);
    request.onerror = (_event) => { // Changed to _event
      console.error('Error adding class:', _event); // Optionally log _event
      reject(new Error('Error adding class.'));
    };
  });
};

export const getClasses = async(): Promise<Class[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([CLASS_STORE], 'readonly');
    const store = transaction.objectStore(CLASS_STORE);
    transaction.onerror = (_event) => reject(new Error('Transaction error getting classes.')); // Changed
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result as Class[]);
    request.onerror = (_event) => reject(new Error('Error getting classes.')); // Changed
  });
};

export const getClass = async(id: number): Promise<Class | undefined> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([CLASS_STORE], 'readonly');
    const store = transaction.objectStore(CLASS_STORE);
    transaction.onerror = (_event) => reject(new Error('Transaction error getting class.')); // Changed
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result as Class | undefined);
    request.onerror = (_event) => reject(new Error('Error getting class.')); // Changed
  });
};

export const updateClass = async(id: number, updates: Partial<Omit<Class, 'id'>>): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([CLASS_STORE], 'readwrite');
    const store = transaction.objectStore(CLASS_STORE);
    transaction.onerror = (_event) => reject(new Error('Transaction error updating class.')); // Changed

    const getRequest = store.get(id);
    getRequest.onsuccess = () => {
      const classData = getRequest.result as Class | undefined;
      if (!classData) {
        reject(new Error(`Class with ID ${id} not found for update.`));
        return;
      }
      const { id: _idFromUpdates, ...restOfUpdates } = updates as any; 
      const updatedClass = { ...classData, ...restOfUpdates };
      
      const updateRequest = store.put(updatedClass);
      updateRequest.onsuccess = () => resolve();
      updateRequest.onerror = (_event) => reject(new Error('Error updating class data.')); // Changed
    };
    getRequest.onerror = (_event) => reject(new Error('Error getting class for update.')); // Changed
  });
};

export const deleteClass = async(id: number): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([CLASS_STORE, PDF_STORE], 'readwrite');
    const classStore = transaction.objectStore(CLASS_STORE);
    const pdfStore = transaction.objectStore(PDF_STORE);
    const pdfClassIndex = pdfStore.index('classId');

    transaction.onerror = (_event) => reject(new Error('Transaction error deleting class.')); // Changed
    transaction.oncomplete = () => resolve();

    const cursorRequest = pdfClassIndex.openCursor(IDBKeyRange.only(id));
    cursorRequest.onsuccess = (event) => { // Keep event if used, like (event.target as ...)
      const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else { 
        const deleteClassRequest = classStore.delete(id);
        deleteClassRequest.onerror = (errEvent) => {
          console.error('Error deleting class record:', errEvent);
          transaction.abort(); 
        };
      }
    };
    cursorRequest.onerror = (errEvent) => { // Use errEvent if you log it
      console.error('Error iterating PDFs for deletion:', errEvent);
      transaction.abort();
    };
  });
};

export const addPDF = async(pdfData: Omit<PDF, 'id'>): Promise<number> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PDF_STORE, CLASS_STORE], 'readwrite');
    const pdfStore = transaction.objectStore(PDF_STORE);
    const classStore = transaction.objectStore(CLASS_STORE);

    transaction.onerror = (_event) => reject(new Error('Transaction error adding PDF.')); // Changed
    
    const pdfToAdd: Omit<PDF, 'id'> = {
        ...pdfData,
        orderIndex: undefined 
    };

    const request = pdfStore.add(pdfToAdd);
    request.onsuccess = async() => {
      const pdfId = request.result as number;
      try {
        await _updateClassCountersInTransaction(classStore, pdfData.classId, 1, 0);
        resolve(pdfId);
      } catch (error) {
        console.error("Error updating class counters after adding PDF", error);
        resolve(pdfId); 
      }
    };
    request.onerror = (_event) => reject(new Error('Error adding PDF record.')); // Changed
  });
};

export const getClassPDFs = async(classId: number): Promise<PDF[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PDF_STORE], 'readonly');
    const store = transaction.objectStore(PDF_STORE);
    const index = store.index('classId');
    transaction.onerror = (_event) => reject(new Error('Transaction error getting class PDFs.')); // Changed
    const request = index.getAll(IDBKeyRange.only(classId));
    request.onsuccess = () => {
        const pdfs = request.result as PDF[];
        pdfs.sort((a, b) => {
            const aHasOrder = a.orderIndex !== undefined && a.orderIndex !== null;
            const bHasOrder = b.orderIndex !== undefined && b.orderIndex !== null;
            if (aHasOrder && bHasOrder) return a.orderIndex! - b.orderIndex!;
            if (aHasOrder) return -1; 
            if (bHasOrder) return 1;  
            return a.name.localeCompare(b.name);
        });
        resolve(pdfs);
    };
    request.onerror = (_event) => reject(new Error('Error getting class PDFs from DB.')); // Changed
  });
};

export const getPDF = async(id: number): Promise<PDF | undefined> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PDF_STORE], 'readonly');
    const store = transaction.objectStore(PDF_STORE);
    transaction.onerror = (_event) => reject(new Error('Transaction error getting PDF.')); // Changed
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result as PDF | undefined);
    request.onerror = (_event) => reject(new Error('Error getting PDF from DB.')); // Changed
  });
};

export const updatePDFStatus = async(pdfId: number, newStatus: 'to-study' | 'done'): Promise<void> => {
  const db = await initDB();
  const pdf = await getPDF(pdfId); 
  if (!pdf) return Promise.reject(new Error(`PDF with ID ${pdfId} not found.`));
  if (pdf.status === newStatus) return Promise.resolve(); 

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PDF_STORE, CLASS_STORE], 'readwrite');
    const pdfStore = transaction.objectStore(PDF_STORE);
    const classStore = transaction.objectStore(CLASS_STORE);
    transaction.onerror = (_event) => reject(new Error('Transaction error updating PDF status.')); // Changed

    const updatedPDFData = { ...pdf, status: newStatus };
    const request = pdfStore.put(updatedPDFData);
    request.onsuccess = async() => {
      try {
        const doneDelta = newStatus === 'done' ? 1 : (pdf.status === 'done' ? -1 : 0);
        if (doneDelta !== 0) { 
             await _updateClassCountersInTransaction(classStore, pdf.classId, 0, doneDelta);
        }
        resolve();
      } catch (error) { reject(error); }
    };
    request.onerror = (_event) => reject(new Error('Error updating PDF status in DB.')); // Changed
  });
};

export const deletePDF = async(pdfId: number): Promise<void> => {
  const db = await initDB();
  const pdf = await getPDF(pdfId); 
  if (!pdf) { console.warn(`PDF with ID ${pdfId} not found for deletion.`); return Promise.resolve(); }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PDF_STORE, CLASS_STORE], 'readwrite');
    const pdfStore = transaction.objectStore(PDF_STORE);
    const classStore = transaction.objectStore(CLASS_STORE);
    transaction.onerror = (_event) => reject(new Error('Transaction error deleting PDF.')); // Changed

    const request = pdfStore.delete(pdfId);
    request.onsuccess = async() => {
      try {
        const doneDelta = pdf.status === 'done' ? -1 : 0;
        await _updateClassCountersInTransaction(classStore, pdf.classId, -1, doneDelta);
        resolve();
      } catch (error) { reject(error); }
    };
    request.onerror = (_event) => reject(new Error('Error deleting PDF from DB.')); // Changed
  });
};

export const updateMultiplePDFOrders = async(updates: Array<{ id: number; orderIndex: number }>): Promise<void> => {
  const db = await initDB();
  return new Promise<void>((resolve, reject) => {
    if (updates.length === 0) { resolve(); return; }

    const transaction = db.transaction([PDF_STORE], 'readwrite');
    const store = transaction.objectStore(PDF_STORE);
    let operationsPending = updates.length;

    transaction.oncomplete = () => {
      console.log("PDF order update transaction completed.");
      resolve();
    };
    transaction.onerror = (event) => { // Keep event for logging
      console.error('Transaction error while updating PDF orders:', (event.target as IDBRequest).error);
      reject(new Error('Transaction error while updating PDF orders.'));
    };
    transaction.onabort = () => {
      console.warn('PDF order update transaction aborted.');
      reject(new Error('PDF order update transaction aborted.'));
    };

    updates.forEach(update => {
      const getRequest = store.get(update.id);
      getRequest.onsuccess = () => {
        const pdf = getRequest.result as PDF | undefined;
        if (pdf) {
          const updatedPDF = { ...pdf, orderIndex: update.orderIndex };
          const putRequest = store.put(updatedPDF);
          putRequest.onsuccess = () => {
            operationsPending--;
          };
          putRequest.onerror = (event) => { // Keep event for logging
            console.error(`Error updating order for PDF ID ${update.id}:`, (event.target as IDBRequest).error);
            if (!transaction.error) transaction.abort(); 
          };
        } else {
          console.warn(`PDF with ID ${update.id} not found for order update.`);
          operationsPending--;
        }
      };
      getRequest.onerror = (event) => { // Keep event for logging
        console.error(`Error fetching PDF ID ${update.id} for order update:`, (event.target as IDBRequest).error);
        if (!transaction.error) transaction.abort();
      };
    });
  });
};

export const toggleClassPin = async(id: number): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([CLASS_STORE], 'readwrite');
    const store = transaction.objectStore(CLASS_STORE);
    transaction.onerror = (_event) => reject(new Error('Transaction error toggling pin.')); // Changed
    const getRequest = store.get(id);
    getRequest.onsuccess = () => {
      const classData = getRequest.result as Class | undefined;
      if (!classData) { reject(new Error(`Class ${id} not found.`)); return; }
      const updatedClass = { ...classData, isPinned: !classData.isPinned };
      const updateRequest = store.put(updatedClass);
      updateRequest.onsuccess = () => resolve();
      updateRequest.onerror = (_event) => reject(new Error('Error updating pin.')); // Changed
    };
    getRequest.onerror = (_event) => reject(new Error('Error getting class for pin.')); // Changed
  });
};

export const getPinnedClasses = async(): Promise<Class[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([CLASS_STORE], 'readonly');
    const store = transaction.objectStore(CLASS_STORE);
    const index = store.index('isPinned');
    transaction.onerror = (_event) => reject(new Error('Transaction error getting pinned classes.')); // Changed
    const request = index.getAll(IDBKeyRange.only(true));
    request.onsuccess = () => resolve(request.result as Class[]);
    request.onerror = (_event) => reject(new Error('Error getting pinned classes.')); // Changed
  });
};

export const getAllPDFs = async(): Promise<PDF[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PDF_STORE], 'readonly');
    const store = transaction.objectStore(PDF_STORE);
    transaction.onerror = (_event) => reject(new Error('Transaction error getting all PDFs.')); // Changed
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result as PDF[]);
    request.onerror = (_event) => reject(new Error('Error getting all PDFs from DB.')); // Changed
  });
};