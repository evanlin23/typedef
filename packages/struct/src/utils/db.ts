// src/utils/db.ts
import type { PDF, Class } from './types';
import { 
  idbRequestToPromise, 
  executeTransaction
} from './idbUtils';

// Database constants
const DB_NAME = 'pdf-study-app';
const DB_VERSION = 2;
const PDF_STORE = 'pdfs';
const CLASS_STORE = 'classes';

// Status types
type PDFStatus = 'to-study' | 'done';

// Connection cache
let dbConnection: IDBDatabase | null = null;

/**
 * Initializes and returns the database connection
 * @returns Promise resolving to the database connection
 */
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
      
      // Handle connection closure
      dbConnection.onclose = () => {
        console.warn('Database connection closed.');
        dbConnection = null;
      };
      
      // Handle version change
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

      // Create PDF store if needed (v1)
      if (oldVersion < 1) {
        if (!db.objectStoreNames.contains(PDF_STORE)) {
          const pdfStore = db.createObjectStore(PDF_STORE, { keyPath: 'id', autoIncrement: true });
          pdfStore.createIndex('status', 'status', { unique: false });
          pdfStore.createIndex('dateAdded', 'dateAdded', { unique: false });
        }
      }

      // Create Class store if needed (v2)
      if (oldVersion < 2) {
        if (!db.objectStoreNames.contains(CLASS_STORE)) {
          const classStore = db.createObjectStore(CLASS_STORE, { keyPath: 'id' });
          classStore.createIndex('name', 'name', { unique: false });
          classStore.createIndex('dateCreated', 'dateCreated', { unique: false });
          classStore.createIndex('isPinned', 'isPinned', { unique: false });
        }
        
        // Add classId index to PDF store
        const currentTransaction = transaction || db.transaction(PDF_STORE, 'readwrite');
        const pdfStore = currentTransaction.objectStore(PDF_STORE);
        if (!pdfStore.indexNames.contains('classId')) {
          pdfStore.createIndex('classId', 'classId', { unique: false });
        }
      }
    };
  });
};

/**
 * Updates class counters within an existing transaction
 * @param classStore The class object store
 * @param classId The class ID to update
 * @param pdfDelta Change in PDF count
 * @param doneDelta Change in done count
 */
const updateClassCounters = async (
  classStore: IDBObjectStore,
  classId: string,
  pdfDelta: number,
  doneDelta: number,
): Promise<void> => {
  const classData = await idbRequestToPromise<Class | undefined>(classStore.get(classId));
  
  if (!classData) {
    console.warn(`Class with id ${classId} not found for counter update.`);
    return;
  }
  
  const updatedClass = {
    ...classData,
    pdfCount: Math.max(0, (classData.pdfCount || 0) + pdfDelta),
    doneCount: Math.max(0, (classData.doneCount || 0) + doneDelta),
  };
  
  await idbRequestToPromise(classStore.put(updatedClass));
};

/**
 * Adds a new class to the database
 * @param classData The class data to add
 * @returns Promise resolving to the new class ID
 */
export const addClass = async (
  classData: Omit<Class, 'id' | 'pdfCount' | 'doneCount' | 'notes'>
): Promise<string> => {
  const db = await initDB();
  
  return executeTransaction(db, [CLASS_STORE], 'readwrite', async (stores) => {
    const newId = crypto.randomUUID();
    
    const newClass: Class = {
      id: newId,
      ...classData,
      pdfCount: 0,
      doneCount: 0,
      isPinned: classData.isPinned || false,
      notes: '',
    };
    
    await idbRequestToPromise(stores[CLASS_STORE].add(newClass));
    return newId;
  });
};

/**
 * Gets all classes from the database
 * @returns Promise resolving to an array of classes
 */
export const getClasses = async (): Promise<Class[]> => {
  const db = await initDB();
  
  return executeTransaction(db, [CLASS_STORE], 'readonly', async (stores) => {
    return idbRequestToPromise<Class[]>(stores[CLASS_STORE].getAll());
  });
};

/**
 * Gets a specific class by ID
 * @param id The class ID
 * @returns Promise resolving to the class or undefined if not found
 */
export const getClass = async (id: string): Promise<Class | undefined> => {
  const db = await initDB();
  
  return executeTransaction(db, [CLASS_STORE], 'readonly', async (stores) => {
    return idbRequestToPromise<Class | undefined>(stores[CLASS_STORE].get(id));
  });
};

/**
 * Updates a class with the provided updates
 * @param id The class ID to update
 * @param updates The updates to apply
 */
export const updateClass = async (
  id: string, 
  updates: Partial<Omit<Class, 'id'>>
): Promise<void> => {
  const db = await initDB();
  
  return executeTransaction(db, [CLASS_STORE], 'readwrite', async (stores) => {
    const classData = await idbRequestToPromise<Class | undefined>(stores[CLASS_STORE].get(id));
    
    if (!classData) {
      throw new Error(`Class with ID ${id} not found for update.`);
    }
    
    const updatedClass = { ...classData, ...updates };
    await idbRequestToPromise(stores[CLASS_STORE].put(updatedClass));
  });
};

/**
 * Deletes a class and all its associated PDFs
 * @param id The class ID to delete
 */
export const deleteClass = async (id: string): Promise<void> => {
  const db = await initDB();
  
  return executeTransaction(db, [CLASS_STORE, PDF_STORE], 'readwrite', async (stores) => {
    const pdfStore = stores[PDF_STORE];
    const classStore = stores[CLASS_STORE];
    const pdfClassIndex = pdfStore.index('classId');
    
    // Delete all PDFs associated with the class
    await new Promise<void>((resolve, reject) => {
      const cursorReq = pdfClassIndex.openCursor(IDBKeyRange.only(id));
      
      cursorReq.onsuccess = async (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
        
        if (cursor) {
          try {
            await idbRequestToPromise(cursor.delete());
            cursor.continue();
          } catch (err) {
            reject(err);
          }
        } else {
          resolve();
        }
      };
      
      cursorReq.onerror = (event) => {
        reject((event.target as IDBRequest).error);
      };
    });
    
    // Delete the class itself
    await idbRequestToPromise(classStore.delete(id));
  });
};

/**
 * Adds a new PDF to the database
 * @param pdfData The PDF data to add
 * @returns Promise resolving to the new PDF ID
 */
export const addPDF = async (pdfData: Omit<PDF, 'id'>): Promise<number> => {
  const db = await initDB();
  
  return executeTransaction(db, [PDF_STORE, CLASS_STORE], 'readwrite', async (stores) => {
    // Add the PDF
    const addedKey = await idbRequestToPromise(stores[PDF_STORE].add(pdfData));
    
    if (typeof addedKey !== 'number') {
      throw new Error('Failed to add PDF: received non-numeric key.');
    }
    
    // Update class counters
    await updateClassCounters(stores[CLASS_STORE], pdfData.classId, 1, 0);
    
    return addedKey;
  });
};

/**
 * Gets all PDFs for a specific class
 * @param classId The class ID
 * @returns Promise resolving to an array of PDFs
 */
export const getClassPDFs = async (classId: string): Promise<PDF[]> => {
  const db = await initDB();
  
  return executeTransaction(db, [PDF_STORE], 'readonly', async (stores) => {
    const index = stores[PDF_STORE].index('classId');
    const pdfs = await idbRequestToPromise<PDF[]>(index.getAll(IDBKeyRange.only(classId))) || [];
    
    // Sort PDFs by orderIndex or name
    if (pdfs.length > 0) {
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
  });
};

/**
 * Gets a specific PDF by ID
 * @param id The PDF ID
 * @returns Promise resolving to the PDF or undefined if not found
 */
export const getPDF = async (id: number): Promise<PDF | undefined> => {
  const db = await initDB();
  
  return executeTransaction(db, [PDF_STORE], 'readonly', async (stores) => {
    return idbRequestToPromise<PDF | undefined>(stores[PDF_STORE].get(id));
  });
};

/**
 * Updates a PDF's status
 * @param pdfId The PDF ID
 * @param newStatus The new status
 */
export const updatePDFStatus = async (
  pdfId: number, 
  newStatus: PDFStatus
): Promise<void> => {
  const db = await initDB();
  
  return executeTransaction(db, [PDF_STORE, CLASS_STORE], 'readwrite', async (stores) => {
    const pdf = await idbRequestToPromise<PDF | undefined>(stores[PDF_STORE].get(pdfId));
    
    if (!pdf) {
      throw new Error(`PDF with ID ${pdfId} not found.`);
    }
    
    // Skip if status hasn't changed
    if (pdf.status === newStatus) return;
    
    // Update the PDF status
    const updatedPDF = { ...pdf, status: newStatus };
    await idbRequestToPromise(stores[PDF_STORE].put(updatedPDF));
    
    // Calculate the change in done count
    const doneDelta = newStatus === 'done' ? 1 : (pdf.status === 'done' ? -1 : 0);
    
    if (doneDelta !== 0) {
      await updateClassCounters(stores[CLASS_STORE], pdf.classId, 0, doneDelta);
    }
  });
};

/**
 * Deletes a PDF
 * @param pdfId The PDF ID to delete
 */
export const deletePDF = async (pdfId: number): Promise<void> => {
  const db = await initDB();
  
  return executeTransaction(db, [PDF_STORE, CLASS_STORE], 'readwrite', async (stores) => {
    const pdf = await idbRequestToPromise<PDF | undefined>(stores[PDF_STORE].get(pdfId));
    
    if (!pdf) {
      console.warn(`PDF with ID ${pdfId} not found for deletion.`);
      return;
    }
    
    // Delete the PDF
    await idbRequestToPromise(stores[PDF_STORE].delete(pdfId));
    
    // Update class counters
    const doneDelta = pdf.status === 'done' ? -1 : 0;
    await updateClassCounters(stores[CLASS_STORE], pdf.classId, -1, doneDelta);
  });
};

/**
 * Updates the order of multiple PDFs
 * @param updates Array of PDF ID and orderIndex pairs
 */
export const updateMultiplePDFOrders = async (
  updates: Array<{ id: number; orderIndex: number }>
): Promise<void> => {
  if (updates.length === 0) return;
  
  const db = await initDB();
  
  return executeTransaction(db, [PDF_STORE], 'readwrite', async (stores) => {
    // Process each update in sequence
    for (const update of updates) {
      const pdf = await idbRequestToPromise<PDF | undefined>(stores[PDF_STORE].get(update.id));
      
      if (pdf) {
        const updatedPDF = { ...pdf, orderIndex: update.orderIndex };
        await idbRequestToPromise(stores[PDF_STORE].put(updatedPDF));
      } else {
        console.warn(`PDF with ID ${update.id} not found for order update.`);
      }
    }
  });
};

/**
 * Toggles the pinned status of a class
 * @param id The class ID
 */
export const toggleClassPin = async (id: string): Promise<void> => {
  const db = await initDB();
  
  return executeTransaction(db, [CLASS_STORE], 'readwrite', async (stores) => {
    const classData = await idbRequestToPromise<Class | undefined>(stores[CLASS_STORE].get(id));
    
    if (!classData) {
      throw new Error(`Class ${id} not found.`);
    }
    
    const updatedClass = { ...classData, isPinned: !classData.isPinned };
    await idbRequestToPromise(stores[CLASS_STORE].put(updatedClass));
  });
};

/**
 * Gets all pinned classes
 * @returns Promise resolving to an array of pinned classes
 */
export const getPinnedClasses = async (): Promise<Class[]> => {
  const db = await initDB();
  
  return executeTransaction(db, [CLASS_STORE], 'readonly', async (stores) => {
    const index = stores[CLASS_STORE].index('isPinned');
    return idbRequestToPromise<Class[]>(index.getAll(IDBKeyRange.only(true as any)));
  });
};

/**
 * Gets all PDFs in the database
 * @returns Promise resolving to an array of all PDFs
 */
export const getAllPDFs = async (): Promise<PDF[]> => {
  const db = await initDB();
  
  return executeTransaction(db, [PDF_STORE], 'readonly', async (stores) => {
    return idbRequestToPromise<PDF[]>(stores[PDF_STORE].getAll());
  });
};