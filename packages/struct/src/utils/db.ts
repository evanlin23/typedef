// src/utils/db.ts
import type { PDF, Class } from './types';

const DB_NAME = 'pdf-study-app';
const DB_VERSION = 2; // Current version based on original code
const PDF_STORE = 'pdfs';
const CLASS_STORE = 'classes';

let dbConnection: IDBDatabase | null = null;

/**
 * Initializes and returns a connection to the IndexedDB database.
 * @returns {Promise<IDBDatabase>} A promise that resolves with the database connection.
 */
export const initDB = (): Promise<IDBDatabase> => {
  if (dbConnection) {
    return Promise.resolve(dbConnection);
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error('IndexedDB error:', event);
      reject(new Error('Error opening database'));
    };

    request.onsuccess = (event) => {
      dbConnection = (event.target as IDBOpenDBRequest).result;
      // Handle connection closing unexpectedly
      dbConnection.onclose = () => {
        console.warn('Database connection closed.');
        dbConnection = null;
      };
      // Handle version change requests from other tabs/windows
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
          // classId index added in version 2
        }
      }

      if (oldVersion < 2) {
        if (!db.objectStoreNames.contains(CLASS_STORE)) {
          const classStore = db.createObjectStore(CLASS_STORE, { keyPath: 'id', autoIncrement: true });
          classStore.createIndex('name', 'name', { unique: false });
          classStore.createIndex('dateCreated', 'dateCreated', { unique: false });
          classStore.createIndex('isPinned', 'isPinned', { unique: false }); // Index for pinned status
        }
        // Ensure transaction is available for schema modification
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

// --- Internal Helper for Class Counter Updates ---
/**
 * Updates PDF and done counts for a class within a transaction.
 * @param classStore The IDBObjectStore for classes.
 * @param classId The ID of the class to update.
 * @param pdfDelta Change in total PDF count (+1, -1, or 0).
 * @param doneDelta Change in done PDF count (+1, -1, or 0).
 * @returns {Promise<void>}
 * @private
 */
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
        console.error('Error updating class counters:', errEvent);
        reject(new Error('Failed to update class counters.'));
      };
    } else {
      console.warn(`Class with id ${classId} not found for counter update.`);
      resolve(); // Resolve even if class not found to not break the chain, or reject based on strictness
    }
  };
  getRequest.onerror = (errEvent) => {
    console.error('Error fetching class for counter update:', errEvent);
    reject(new Error('Failed to fetch class for counter update.'));
  };
});


// --- Class related functions ---

/**
 * Adds a new class to the database.
 * @param {Omit<Class, 'id' | 'pdfCount' | 'doneCount'>} classData - Data for the new class.
 * @returns {Promise<number>} A promise that resolves with the ID of the newly added class.
 */
export const addClass = async(classData: Omit<Class, 'id' | 'pdfCount' | 'doneCount'>): Promise<number> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([CLASS_STORE], 'readwrite');
    const store = transaction.objectStore(CLASS_STORE);
    transaction.onerror = (event) => {
      console.error('Transaction error while adding class:', event);
      reject(new Error('Transaction error while adding class.'));
    };

    const newClass: Class = {
      ...classData,
      pdfCount: 0,
      doneCount: 0,
      isPinned: classData.isPinned || false, // Ensure isPinned is initialized
    };

    const request = store.add(newClass);
    request.onsuccess = () => resolve(request.result as number);
    request.onerror = (event) => {
      console.error('Error adding class:', event);
      reject(new Error('Error adding class.'));
    };
  });
};

/**
 * Retrieves all classes from the database.
 * @returns {Promise<Class[]>} A promise that resolves with an array of classes.
 */
export const getClasses = async(): Promise<Class[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([CLASS_STORE], 'readonly');
    const store = transaction.objectStore(CLASS_STORE);
    transaction.onerror = (event) => {
      console.error('Transaction error while getting classes:', event);
      reject(new Error('Transaction error while getting classes.'));
    };
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result as Class[]);
    request.onerror = (event) => {
      console.error('Error getting classes:', event);
      reject(new Error('Error getting classes.'));
    };
  });
};

/**
 * Retrieves a specific class by its ID.
 * @param {number} id - The ID of the class to retrieve.
 * @returns {Promise<Class | undefined>} A promise that resolves with the class data, or undefined if not found.
 */
export const getClass = async(id: number): Promise<Class | undefined> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([CLASS_STORE], 'readonly');
    const store = transaction.objectStore(CLASS_STORE);
    transaction.onerror = (event) => {
      console.error('Transaction error while getting class:', event);
      reject(new Error('Transaction error while getting class.'));
    };
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result as Class | undefined);
    request.onerror = (event) => {
      console.error('Error getting class:', event);
      reject(new Error('Error getting class.'));
    };
  });
};

/**
 * Updates an existing class.
 * @param {number} id - The ID of the class to update.
 * @param {Partial<Class>} updates - An object containing the fields to update.
 * @returns {Promise<void>}
 */
export const updateClass = async(id: number, updates: Partial<Class>): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([CLASS_STORE], 'readwrite');
    const store = transaction.objectStore(CLASS_STORE);
    transaction.onerror = (event) => {
      console.error('Transaction error while updating class:', event);
      reject(new Error('Transaction error while updating class.'));
    };

    const getRequest = store.get(id);
    getRequest.onsuccess = () => {
      const classData = getRequest.result as Class | undefined;
      if (!classData) {
        reject(new Error(`Class with ID ${id} not found for update.`));
        return;
      }
      const updatedClass = { ...classData, ...updates };
      const updateRequest = store.put(updatedClass);
      updateRequest.onsuccess = () => resolve();
      updateRequest.onerror = (event) => {
        console.error('Error updating class:', event);
        reject(new Error('Error updating class.'));
      };
    };
    getRequest.onerror = (event) => {
      console.error('Error getting class for update:', event);
      reject(new Error('Error getting class for update.'));
    };
  });
};

/**
 * Deletes a class and all its associated PDFs.
 * @param {number} id - The ID of the class to delete.
 * @returns {Promise<void>}
 */
export const deleteClass = async(id: number): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([CLASS_STORE, PDF_STORE], 'readwrite');
    const classStore = transaction.objectStore(CLASS_STORE);
    const pdfStore = transaction.objectStore(PDF_STORE);
    const pdfClassIndex = pdfStore.index('classId');

    transaction.onerror = (event) => {
      console.error('Transaction error while deleting class:', event);
      reject(new Error('Transaction error while deleting class and its PDFs.'));
    };
    transaction.oncomplete = () => resolve();

    // Delete all PDFs associated with the class
    const cursorRequest = pdfClassIndex.openCursor(IDBKeyRange.only(id));
    cursorRequest.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else {
        // All associated PDFs deleted, now delete the class itself
        const deleteClassRequest = classStore.delete(id);
        deleteClassRequest.onerror = (errEvent) => {
          console.error('Error deleting class:', errEvent);
          // Transaction will abort due to this error
        };
      }
    };
    cursorRequest.onerror = (event) => {
      console.error('Error iterating PDFs for deletion:', event);
      // Transaction will abort
    };
  });
};


// --- PDF related functions ---

/**
 * Adds a PDF to a class and updates the class's PDF count.
 * @param {Omit<PDF, 'id'>} pdfData - Data for the new PDF.
 * @returns {Promise<number>} A promise that resolves with the ID of the newly added PDF.
 */
export const addPDF = async(pdfData: Omit<PDF, 'id'>): Promise<number> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PDF_STORE, CLASS_STORE], 'readwrite');
    const pdfStore = transaction.objectStore(PDF_STORE);
    const classStore = transaction.objectStore(CLASS_STORE);

    transaction.onerror = (event) => {
      console.error('Transaction error while adding PDF:', event);
      reject(new Error('Transaction error while adding PDF.'));
    };

    const request = pdfStore.add(pdfData);
    request.onsuccess = async() => {
      const pdfId = request.result as number;
      try {
        await _updateClassCountersInTransaction(classStore, pdfData.classId, 1, 0);
        resolve(pdfId);
      } catch (error) {
        reject(error); // Propagate error from counter update
      }
    };
    request.onerror = (event) => {
      console.error('Error adding PDF:', event);
      reject(new Error('Error adding PDF.'));
    };
  });
};

/**
 * Retrieves all PDFs for a given class ID.
 * @param {number} classId - The ID of the class.
 * @returns {Promise<PDF[]>} A promise that resolves with an array of PDFs.
 */
export const getClassPDFs = async(classId: number): Promise<PDF[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PDF_STORE], 'readonly');
    const store = transaction.objectStore(PDF_STORE);
    const index = store.index('classId');
    transaction.onerror = (event) => {
      console.error('Transaction error while getting class PDFs:', event);
      reject(new Error('Transaction error while getting class PDFs.'));
    };
    const request = index.getAll(IDBKeyRange.only(classId));
    request.onsuccess = () => resolve(request.result as PDF[]);
    request.onerror = (event) => {
      console.error('Error getting class PDFs:', event);
      reject(new Error('Error getting class PDFs.'));
    };
  });
};

/**
 * Retrieves a specific PDF by its ID.
 * @param {number} id - The ID of the PDF to retrieve.
 * @returns {Promise<PDF | undefined>} A promise that resolves with the PDF data, or undefined if not found.
 */
export const getPDF = async(id: number): Promise<PDF | undefined> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PDF_STORE], 'readonly');
    const store = transaction.objectStore(PDF_STORE);
    transaction.onerror = (event) => {
      console.error('Transaction error while getting PDF:', event);
      reject(new Error('Transaction error while getting PDF.'));
    };
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result as PDF | undefined);
    request.onerror = (event) => {
      console.error('Error getting PDF:', event);
      reject(new Error('Error getting PDF.'));
    };
  });
};

/**
 * Updates the status of a PDF and adjusts the class's done count.
 * @param {number} pdfId - The ID of the PDF to update.
 * @param {'to-study' | 'done'} newStatus - The new status for the PDF.
 * @returns {Promise<void>}
 */
export const updatePDFStatus = async(pdfId: number, newStatus: 'to-study' | 'done'): Promise<void> => {
  const db = await initDB();
  const pdf = await getPDF(pdfId); // Get current PDF details first

  if (!pdf) {
    return Promise.reject(new Error(`PDF with ID ${pdfId} not found.`));
  }
  if (pdf.status === newStatus) {
    return Promise.resolve(); // No change needed
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PDF_STORE, CLASS_STORE], 'readwrite');
    const pdfStore = transaction.objectStore(PDF_STORE);
    const classStore = transaction.objectStore(CLASS_STORE);

    transaction.onerror = (event) => {
      console.error('Transaction error while updating PDF status:', event);
      reject(new Error('Transaction error while updating PDF status.'));
    };

    const updatedPDF = { ...pdf, status: newStatus };
    const request = pdfStore.put(updatedPDF);

    request.onsuccess = async() => {
      try {
        const doneDelta = newStatus === 'done' ? 1 : -1; // If old was 'done' and new is 'to-study', delta is -1
        await _updateClassCountersInTransaction(classStore, pdf.classId, 0, doneDelta);
        resolve();
      } catch (error) {
        reject(error);
      }
    };
    request.onerror = (event) => {
      console.error('Error updating PDF status:', event);
      reject(new Error('Error updating PDF status.'));
    };
  });
};

/**
 * Deletes a PDF and updates the class's PDF and done counts.
 * @param {number} pdfId - The ID of the PDF to delete.
 * @returns {Promise<void>}
 */
export const deletePDF = async(pdfId: number): Promise<void> => {
  const db = await initDB();
  const pdf = await getPDF(pdfId); // Get current PDF details first

  if (!pdf) {
    // PDF already deleted or never existed.
    console.warn(`PDF with ID ${pdfId} not found for deletion.`);
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PDF_STORE, CLASS_STORE], 'readwrite');
    const pdfStore = transaction.objectStore(PDF_STORE);
    const classStore = transaction.objectStore(CLASS_STORE);

    transaction.onerror = (event) => {
      console.error('Transaction error while deleting PDF:', event);
      reject(new Error('Transaction error while deleting PDF.'));
    };

    const request = pdfStore.delete(pdfId);
    request.onsuccess = async() => {
      try {
        const doneDelta = pdf.status === 'done' ? -1 : 0;
        await _updateClassCountersInTransaction(classStore, pdf.classId, -1, doneDelta);
        resolve();
      } catch (error) {
        reject(error);
      }
    };
    request.onerror = (event) => {
      console.error('Error deleting PDF:', event);
      reject(new Error('Error deleting PDF.'));
    };
  });
};

/**
 * Toggles the pinned status of a class.
 * @param {number} id - The ID of the class to pin/unpin.
 * @returns {Promise<void>}
 */
export const toggleClassPin = async(id: number): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([CLASS_STORE], 'readwrite');
    const store = transaction.objectStore(CLASS_STORE);
    transaction.onerror = (event) => {
      console.error('Transaction error while toggling pin status:', event);
      reject(new Error('Transaction error while toggling pin status.'));
    };

    const getRequest = store.get(id);
    getRequest.onsuccess = () => {
      const classData = getRequest.result as Class | undefined;
      if (!classData) {
        reject(new Error(`Class with ID ${id} not found for pinning.`));
        return;
      }
      const updatedClass = { ...classData, isPinned: !classData.isPinned };
      const updateRequest = store.put(updatedClass);
      updateRequest.onsuccess = () => resolve();
      updateRequest.onerror = (event) => {
        console.error('Error updating pin status:', event);
        reject(new Error('Error updating pin status.'));
      };
    };
    getRequest.onerror = (event) => {
      console.error('Error getting class for pin toggle:', event);
      reject(new Error('Error getting class for pin toggle.'));
    };
  });
};

/**
 * Retrieves all pinned classes.
 * @returns {Promise<Class[]>} A promise that resolves with an array of pinned classes.
 */
export const getPinnedClasses = async(): Promise<Class[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([CLASS_STORE], 'readonly');
    const store = transaction.objectStore(CLASS_STORE);
    const index = store.index('isPinned'); // Assuming 'isPinned' index exists
    
    transaction.onerror = (event) => {
      console.error('Transaction error while getting pinned classes:', event);
      reject(new Error('Transaction error while getting pinned classes.'));
    };

    const request = index.getAll(IDBKeyRange.only(true)); // Get all where isPinned is true
    request.onsuccess = () => {
      resolve(request.result as Class[]);
    };
    request.onerror = (event) => {
      console.error('Error getting pinned classes:', event);
      reject(new Error('Error getting pinned classes.'));
    };
  });
};

// Utility to get all PDFs (less commonly used if app is class-centric)
/**
 * Retrieves all PDFs from the database, regardless of class.
 * @returns {Promise<PDF[]>} A promise that resolves with an array of all PDFs.
 */
export const getAllPDFs = async(): Promise<PDF[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PDF_STORE], 'readonly');
    const store = transaction.objectStore(PDF_STORE);
    transaction.onerror = (event) => {
      console.error('Transaction error while getting all PDFs:', event);
      reject(new Error('Transaction error while getting all PDFs.'));
    };
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result as PDF[]);
    request.onerror = (event) => {
      console.error('Error getting all PDFs:', event);
      reject(new Error('Error getting all PDFs.'));
    };
  });
};