import type { PDF, Class } from '../utils/types';

const DB_NAME = 'pdf-study-app';
const DB_VERSION = 2;
const PDF_STORE = 'pdfs';
const CLASS_STORE = 'classes';

// Database connection singleton
let dbConnection: IDBDatabase | null = null;

export const initDB = (): Promise<IDBDatabase> => {
  // If we already have an open connection, use it
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
      
      // Handle connection closing from browser
      dbConnection.onclose = () => {
        dbConnection = null;
      };
      
      // Handle version change events
      dbConnection.onversionchange = () => {
        dbConnection?.close();
        dbConnection = null;
      };
      
      resolve(dbConnection);
    };
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const oldVersion = event.oldVersion;
      
      // Create PDF store if upgrading from version 0
      if (oldVersion < 1) {
        if (!db.objectStoreNames.contains(PDF_STORE)) {
          const pdfStore = db.createObjectStore(PDF_STORE, { 
            keyPath: 'id', 
            autoIncrement: true 
          });
          
          // Create indexes
          pdfStore.createIndex('status', 'status', { unique: false });
          pdfStore.createIndex('dateAdded', 'dateAdded', { unique: false });
        }
      }
      
      // Create class store and add classId index to PDF store if upgrading from version 1
      if (oldVersion < 2) {
        // Create class store
        if (!db.objectStoreNames.contains(CLASS_STORE)) {
          const classStore = db.createObjectStore(CLASS_STORE, {
            keyPath: 'id',
            autoIncrement: true
          });
          
          classStore.createIndex('name', 'name', { unique: false });
          classStore.createIndex('dateCreated', 'dateCreated', { unique: false });
        }
        
        // Add classId index to PDF store
        const transaction = (event.target as IDBOpenDBRequest).transaction;
        const pdfStore = transaction?.objectStore(PDF_STORE);

        if (pdfStore && !pdfStore.indexNames.contains('classId')) {
          pdfStore.createIndex('classId', 'classId', { unique: false });
        }
      }
    };
  });
};

// Class related functions
export const addClass = async (classData: Class): Promise<number> => {
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([CLASS_STORE], 'readwrite');
    const store = transaction.objectStore(CLASS_STORE);
    
    // Set up transaction error handling
    transaction.onerror = (event) => {
      console.error('Transaction error while adding class:', event);
      reject('Transaction error while adding class');
    };
    
    const request = store.add(classData);
    
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
    
    // First get the current object
    const getRequest = store.get(id);
    
    getRequest.onsuccess = (event) => {
      const classData = (event.target as IDBRequest).result as Class;
      const updatedClass = { ...classData, ...updates };
      
      const updateRequest = store.put(updatedClass);
      
      updateRequest.onsuccess = () => {
        resolve();
      };
      
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
    
    // Delete class
    const deleteClassRequest = classStore.delete(id);
    
    deleteClassRequest.onerror = (event) => {
      console.error('Error deleting class:', event);
      reject('Error deleting class');
    };
    
    // Find and delete all PDFs associated with the class
    const pdfCursorRequest = pdfIndex.openCursor(IDBKeyRange.only(id));
    
    pdfCursorRequest.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        pdfStore.delete(cursor.primaryKey);
        cursor.continue();
      } else {
        // All PDFs processed
        resolve();
      }
    };
    
    pdfCursorRequest.onerror = (event) => {
      console.error('Error deleting PDFs for class:', event);
      reject('Error deleting PDFs for class');
    };
  });
};

// PDF related functions
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
    
    // Add the PDF
    const request = pdfStore.add(pdf);
    
    request.onsuccess = (event) => {
      const pdfId = (event.target as IDBRequest).result as number;
      
      // Update the PDF count for the class if classId exists
      if (pdf.classId !== undefined) {
        const getClassRequest = classStore.get(pdf.classId);
        
        getClassRequest.onsuccess = (event) => {
          const classData = (event.target as IDBRequest).result as Class;
          if (classData) {
            classData.pdfCount = (classData.pdfCount || 0) + 1;
            
            const updateClassRequest = classStore.put(classData);
            
            updateClassRequest.onerror = (event) => {
              console.error('Error updating class PDF count:', event);
              // Still resolve with PDF ID since PDF was added successfully
              resolve(pdfId);
            };
            
            updateClassRequest.onsuccess = () => {
              resolve(pdfId);
            };
          } else {
            // Class not found, but PDF was added, so resolve with PDF ID
            resolve(pdfId);
          }
        };
        
        getClassRequest.onerror = (event) => {
          console.error('Error getting class for PDF count update:', event);
          // Still resolve with PDF ID since PDF was added successfully
          resolve(pdfId);
        };
      } else {
        // No class ID, just resolve with PDF ID
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

export const updatePDFStatus = async (id: number, status: 'to-study' | 'done'): Promise<void> => {
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PDF_STORE], 'readwrite');
    const store = transaction.objectStore(PDF_STORE);
    
    transaction.onerror = (event) => {
      console.error('Transaction error while updating PDF status:', event);
      reject('Transaction error while updating PDF status');
    };
    
    // First get the current object
    const getRequest = store.get(id);
    
    getRequest.onsuccess = (event) => {
      const pdf = (event.target as IDBRequest).result as PDF;
      pdf.status = status;
      
      // Update with new status
      const updateRequest = store.put(pdf);
      
      updateRequest.onsuccess = () => {
        resolve();
      };
      
      updateRequest.onerror = (event) => {
        console.error('Error updating PDF status:', event);
        reject('Error updating PDF status');
      };
    };
    
    getRequest.onerror = (event) => {
      console.error('Error getting PDF for update:', event);
      reject('Error getting PDF for update');
    };
  });
};

export const deletePDF = async (id: number): Promise<void> => {
  const db = await initDB();
  
  return new Promise(async (resolve, reject) => {
    try {
      // First get the PDF to check if it belongs to a class
      const pdf = await getPDF(id);
      
      const transaction = db.transaction([PDF_STORE, CLASS_STORE], 'readwrite');
      
      transaction.onerror = (event) => {
        console.error('Transaction error while deleting PDF:', event);
        reject('Transaction error while deleting PDF');
      };
      
      const pdfStore = transaction.objectStore(PDF_STORE);
      
      // Delete the PDF
      const deleteRequest = pdfStore.delete(id);
      
      deleteRequest.onsuccess = () => {
        // If this PDF belongs to a class, update the class PDF count
        if (pdf && pdf.classId !== undefined) {
          const classStore = transaction.objectStore(CLASS_STORE);
          const getClassRequest = classStore.get(pdf.classId);
          
          getClassRequest.onsuccess = (event) => {
            const classData = (event.target as IDBRequest).result as Class;
            
            if (classData && classData.pdfCount > 0) {
              classData.pdfCount -= 1;
              
              const updateClassRequest = classStore.put(classData);
              
              updateClassRequest.onerror = (event) => {
                console.error('Error updating class PDF count after deletion:', event);
                // Still resolve since PDF was deleted successfully
                resolve();
              };
              
              updateClassRequest.onsuccess = () => {
                resolve();
              };
            } else {
              // Class not found or count already 0, so just resolve
              resolve();
            }
          };
          
          getClassRequest.onerror = (event) => {
            console.error('Error getting class for PDF count update after deletion:', event);
            // Still resolve since PDF was deleted successfully
            resolve();
          };
        } else {
          // No class ID, just resolve
          resolve();
        }
      };
      
      deleteRequest.onerror = (event) => {
        console.error('Error deleting PDF:', event);
        reject('Error deleting PDF');
      };
    } catch (error) {
      // If there was an error getting the PDF, just try to delete it anyway
      console.error('Error in deletePDF:', error);
      
      const transaction = db.transaction([PDF_STORE], 'readwrite');
      const store = transaction.objectStore(PDF_STORE);
      
      const request = store.delete(id);
      
      request.onsuccess = () => {
        resolve();
      };
      
      request.onerror = (event) => {
        console.error('Error in fallback PDF deletion:', event);
        reject('Error in fallback PDF deletion');
      };
    }
  });
};