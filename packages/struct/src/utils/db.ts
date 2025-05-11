import type { PDF, Class } from '../utils/types';

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
      console.error('IndexedDB error:', event);
      reject('Error opening database');
    };
    request.onsuccess = (event) => {
      dbConnection = (event.target as IDBOpenDBRequest).result;
      dbConnection.onclose = () => { dbConnection = null; };
      dbConnection.onversionchange = () => {
        dbConnection?.close();
        dbConnection = null;
      };
      resolve(dbConnection);
    };
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
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
        }
        const transaction = (event.target as IDBOpenDBRequest).transaction;
        const pdfStore = transaction?.objectStore(PDF_STORE);
        if (pdfStore && !pdfStore.indexNames.contains('classId')) {
          pdfStore.createIndex('classId', 'classId', { unique: false });
        }
      }
    };
  });
};

// --- Class related functions ---
export const addClass = async (classData: Class): Promise<number> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([CLASS_STORE], 'readwrite');
    const store = transaction.objectStore(CLASS_STORE);
    transaction.onerror = (event) => {
      console.error('Transaction error while adding class:', event);
      reject('Transaction error while adding class');
    };
    // Ensure isPinned is initialized
    const newClass = { 
      ...classData, 
      pdfCount: 0, 
      doneCount: 0,
      isPinned: classData.isPinned || false
    };
    
    const request = store.add(newClass);
    request.onsuccess = (event) => {
      const id = (event.target as IDBRequest).result as number;
      resolve(id);
    };
    request.onerror = (event) => {
      console.error('Error adding class:', event);
      reject('Error adding class');
    };
  });
};

export const getClasses = async (): Promise<Class[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([CLASS_STORE], 'readonly');
    const store = transaction.objectStore(CLASS_STORE);
    transaction.onerror = (event) => {
      console.error('Transaction error while getting classes:', event);
      reject('Transaction error while getting classes');
    };
    const request = store.getAll();
    request.onsuccess = (event) => {
      const classes = (event.target as IDBRequest).result as Class[];
      resolve(classes);
    };
    request.onerror = (event) => {
      console.error('Error getting classes:', event);
      reject('Error getting classes');
    };
  });
};

export const getClass = async (id: number): Promise<Class> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([CLASS_STORE], 'readonly');
    const store = transaction.objectStore(CLASS_STORE);
    transaction.onerror = (event) => {
      console.error('Transaction error while getting class:', event);
      reject('Transaction error while getting class');
    };
    const request = store.get(id);
    request.onsuccess = (event) => {
      resolve((event.target as IDBRequest).result as Class);
    };
    request.onerror = (event) => {
      console.error('Error getting class:', event);
      reject('Error getting class');
    };
  });
};

export const updateClass = async (id: number, updates: Partial<Class>): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([CLASS_STORE], 'readwrite');
    const store = transaction.objectStore(CLASS_STORE);
    transaction.onerror = (event) => {
      console.error('Transaction error while updating class:', event);
      reject('Transaction error while updating class');
    };
    const getRequest = store.get(id);
    getRequest.onsuccess = (event) => {
      const classData = (event.target as IDBRequest).result as Class;
      const updatedClass = { ...classData, ...updates };
      const updateRequest = store.put(updatedClass);
      updateRequest.onsuccess = () => resolve();
      updateRequest.onerror = (event) => {
        console.error('Error updating class:', event);
        reject('Error updating class');
      };
    };
    getRequest.onerror = (event) => {
      console.error('Error getting class for update:', event);
      reject('Error getting class for update');
    };
  });
};

export const deleteClass = async (id: number): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([CLASS_STORE, PDF_STORE], 'readwrite');
    transaction.onerror = (event) => {
      console.error('Transaction error while deleting class:', event);
      reject('Transaction error while deleting class');
    };
    const classStore = transaction.objectStore(CLASS_STORE);
    const pdfStore = transaction.objectStore(PDF_STORE);
    const pdfIndex = pdfStore.index('classId');
    const deleteClassRequest = classStore.delete(id);
    deleteClassRequest.onerror = (event) => {
      console.error('Error deleting class:', event);
      reject('Error deleting class');
    };
    const pdfCursorRequest = pdfIndex.openCursor(IDBKeyRange.only(id));
    pdfCursorRequest.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        pdfStore.delete(cursor.primaryKey);
        cursor.continue();
      } else {
        resolve();
      }
    };
    pdfCursorRequest.onerror = (event) => {
      console.error('Error deleting PDFs for class:', event);
      reject('Error deleting PDFs for class');
    };
  });
};

// --- PDF related functions ---

// Add PDF (and update class pdfCount)
export const addPDF = async (pdf: PDF): Promise<number> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PDF_STORE, CLASS_STORE], 'readwrite');
    transaction.onerror = (event) => {
      console.error('Transaction error while adding PDF:', event);
      reject('Transaction error while adding PDF');
    };
    const pdfStore = transaction.objectStore(PDF_STORE);
    const classStore = transaction.objectStore(CLASS_STORE);
    const request = pdfStore.add(pdf);
    request.onsuccess = (event) => {
      const pdfId = (event.target as IDBRequest).result as number;
      if (pdf.classId !== undefined) {
        const getClassRequest = classStore.get(pdf.classId);
        getClassRequest.onsuccess = (event) => {
          const classData = (event.target as IDBRequest).result as Class;
          if (classData) {
            const newPdfCount = (classData.pdfCount || 0) + 1;
            const newDoneCount = classData.doneCount || 0;
            const updateClassRequest = classStore.put({
              ...classData,
              pdfCount: newPdfCount,
              doneCount: newDoneCount
            });
            updateClassRequest.onerror = (event) => {
              console.error('Error updating class PDF count:', event);
              resolve(pdfId);
            };
            updateClassRequest.onsuccess = () => {
              resolve(pdfId);
            };
          } else {
            resolve(pdfId);
          }
        };
        getClassRequest.onerror = (event) => {
          console.error('Error getting class for PDF count update:', event);
          resolve(pdfId);
        };
      } else {
        resolve(pdfId);
      }
    };
    request.onerror = (event) => {
      console.error('Error adding PDF:', event);
      reject('Error adding PDF');
    };
  });
};

export const getPDFs = async (): Promise<PDF[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PDF_STORE], 'readonly');
    const store = transaction.objectStore(PDF_STORE);
    transaction.onerror = (event) => {
      console.error('Transaction error while getting PDFs:', event);
      reject('Transaction error while getting PDFs');
    };
    const request = store.getAll();
    request.onsuccess = (event) => {
      resolve((event.target as IDBRequest).result as PDF[]);
    };
    request.onerror = (event) => {
      console.error('Error getting PDFs:', event);
      reject('Error getting PDFs');
    };
  });
};

export const getClassPDFs = async (classId: number): Promise<PDF[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PDF_STORE], 'readonly');
    const store = transaction.objectStore(PDF_STORE);
    transaction.onerror = (event) => {
      console.error('Transaction error while getting class PDFs:', event);
      reject('Transaction error while getting class PDFs');
    };
    const index = store.index('classId');
    const request = index.getAll(IDBKeyRange.only(classId));
    request.onsuccess = (event) => {
      resolve((event.target as IDBRequest).result as PDF[]);
    };
    request.onerror = (event) => {
      console.error('Error getting class PDFs:', event);
      reject('Error getting class PDFs');
    };
  });
};

export const getPDF = async (id: number): Promise<PDF> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PDF_STORE], 'readonly');
    const store = transaction.objectStore(PDF_STORE);
    transaction.onerror = (event) => {
      console.error('Transaction error while getting PDF:', event);
      reject('Transaction error while getting PDF');
    };
    const request = store.get(id);
    request.onsuccess = (event) => {
      resolve((event.target as IDBRequest).result as PDF);
    };
    request.onerror = (event) => {
      console.error('Error getting PDF:', event);
      reject('Error getting PDF');
    };
  });
};

// Update PDF status (and update class doneCount)
export const updatePDFStatus = async (id: number, status: 'to-study' | 'done'): Promise<void> => {
  const db = await initDB();
  return new Promise(async (resolve, reject) => {
    try {
      // 1. Get current PDF
      const pdf = await getPDF(id);
      const oldStatus = pdf.status;
      const classId = pdf.classId;

      // 2. Update PDF status
      const transaction = db.transaction([PDF_STORE, CLASS_STORE], 'readwrite');
      const pdfStore = transaction.objectStore(PDF_STORE);
      const classStore = transaction.objectStore(CLASS_STORE);

      const updatePDFRequest = pdfStore.put({ ...pdf, status });
      updatePDFRequest.onerror = (event) => {
        console.error('Error updating PDF status:', event);
        reject('Error updating PDF status');
      };

      updatePDFRequest.onsuccess = () => {
        // 3. If status changed and has class, update doneCount
        if (classId !== undefined && oldStatus !== status) {
          const getClassRequest = classStore.get(classId);
          getClassRequest.onsuccess = (event) => {
            const classObj = (event.target as IDBRequest).result as Class;
            if (classObj) {
              let doneCount = classObj.doneCount || 0;
              if (status === 'done' && oldStatus === 'to-study') {
                doneCount += 1;
              } else if (status === 'to-study' && oldStatus === 'done') {
                doneCount = Math.max(0, doneCount - 1);
              }
              const updateClassRequest = classStore.put({
                ...classObj,
                doneCount,
              });
              updateClassRequest.onerror = (event) => {
                console.error('Error updating class doneCount:', event);
                resolve();
              };
              updateClassRequest.onsuccess = () => resolve();
            } else {
              resolve();
            }
          };
          getClassRequest.onerror = (event) => {
            console.error('Error getting class for doneCount update:', event);
            resolve();
          };
        } else {
          resolve();
        }
      };
    } catch (error) {
      console.error('Error in updatePDFStatus:', error);
      reject('Error in updatePDFStatus');
    }
  });
};

// Delete PDF (and update class pdfCount and doneCount)
export const deletePDF = async (id: number): Promise<void> => {
  const db = await initDB();
  return new Promise(async (resolve, reject) => {
    try {
      const pdf = await getPDF(id);
      const status = pdf.status;
      const classId = pdf.classId;

      const transaction = db.transaction([PDF_STORE, CLASS_STORE], 'readwrite');
      const pdfStore = transaction.objectStore(PDF_STORE);
      const classStore = transaction.objectStore(CLASS_STORE);

      const deleteRequest = pdfStore.delete(id);
      deleteRequest.onerror = (event) => {
        console.error('Error deleting PDF:', event);
        reject('Error deleting PDF');
      };
      deleteRequest.onsuccess = () => {
        if (classId !== undefined) {
          const getClassRequest = classStore.get(classId);
          getClassRequest.onsuccess = (event) => {
            const classObj = (event.target as IDBRequest).result as Class;
            if (classObj) {
              const newPdfCount = Math.max(0, (classObj.pdfCount || 0) - 1);
              let doneCount = classObj.doneCount || 0;
              if (status === 'done') {
                doneCount = Math.max(0, doneCount - 1);
              }
              const updateClassRequest = classStore.put({
                ...classObj,
                pdfCount: newPdfCount,
                doneCount,
              });
              updateClassRequest.onerror = (event) => {
                console.error('Error updating class after PDF deletion:', event);
                resolve();
              };
              updateClassRequest.onsuccess = () => resolve();
            } else {
              resolve();
            }
          };
          getClassRequest.onerror = (event) => {
            console.error('Error getting class for PDF count update after deletion:', event);
            resolve();
          };
        } else {
          resolve();
        }
      };
    } catch (error) {
      // Fallback: just delete
      console.error('Error in deletePDF:', error);
      const transaction = db.transaction([PDF_STORE], 'readwrite');
      const store = transaction.objectStore(PDF_STORE);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = (event) => {
        console.error('Error in fallback PDF deletion:', event);
        reject('Error in fallback PDF deletion');
      };
    }
  });
};

export const toggleClassPin = async (id: number): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([CLASS_STORE], 'readwrite');
    const store = transaction.objectStore(CLASS_STORE);
    transaction.onerror = (event) => {
      console.error('Transaction error while toggling pin status:', event);
      reject('Transaction error while toggling pin status');
    };
    
    const getRequest = store.get(id);
    getRequest.onsuccess = (event) => {
      const classData = (event.target as IDBRequest).result as Class;
      if (classData) {
        const updatedClass = { 
          ...classData, 
          isPinned: !classData.isPinned 
        };
        
        const updateRequest = store.put(updatedClass);
        updateRequest.onsuccess = () => resolve();
        updateRequest.onerror = (event) => {
          console.error('Error updating pin status:', event);
          reject('Error updating pin status');
        };
      } else {
        reject('Class not found');
      }
    };
    
    getRequest.onerror = (event) => {
      console.error('Error getting class for pin toggle:', event);
      reject('Error getting class for pin toggle');
    };
  });
};

// Get all pinned classes
export const getPinnedClasses = async (): Promise<Class[]> => {
  const classes = await getClasses();
  return classes.filter(cls => cls.isPinned);
};