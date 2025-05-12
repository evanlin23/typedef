import { vi, describe, test, expect, beforeEach } from 'vitest';
import type { Class, PDF } from '../../utils/types';

// Mock the entire database module
vi.mock('../../utils/db', () => {
  return {
    initDB: vi.fn().mockResolvedValue({}),
    addClass: vi.fn(),
    getClasses: vi.fn(),
    getClass: vi.fn(),
    updateClass: vi.fn(),
    deleteClass: vi.fn(),
    addPDF: vi.fn(),
    getPDF: vi.fn(),
    getClassPDFs: vi.fn(),
    updatePDFStatus: vi.fn(),
    deletePDF: vi.fn(),
    updateMultiplePDFOrders: vi.fn()
  };
});

// Import the mocked functions after vi.mock
import {
  addClass,
  getClasses,
  getClass,
  updateClass,
  deleteClass,
  addPDF,
  getPDF,
  getClassPDFs,
  updatePDFStatus,
  deletePDF,
  updateMultiplePDFOrders
} from '../../utils/db';

describe('Database Utils', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    vi.resetAllMocks();
    
    // Mock crypto.randomUUID for consistent test results
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('mock-uuid' as `${string}-${string}-${string}-${string}-${string}`);
  });

  // addClass tests
  test('addClass adds a new class', async () => {
    // Set up the mock implementation
    (addClass as any).mockResolvedValue('mock-uuid');
    
    // Create test data
    const classData = {
      name: 'Test Class',
      dateCreated: Date.now(),
      isPinned: false
    };
    
    // Call the function
    const id = await addClass(classData);
    
    // Verify the result
    expect(id).toBe('mock-uuid');
    
    // Verify that the function was called with correct parameters
    expect(addClass).toHaveBeenCalledWith(classData);
  });

  test('addClass handles database error', async () => {
    // Set up the mock implementation to throw an error
    const dbError = new Error('Database transaction failed');
    (addClass as any).mockRejectedValue(dbError);
    
    // Create test data
    const classData = {
      name: 'Error Class',
      dateCreated: Date.now(),
      isPinned: false
    };
    
    // Call and verify that it rejects
    await expect(addClass(classData)).rejects.toThrow('Database transaction failed');
  });

  test('addClass with missing required fields', async () => {
    // Set up the mock implementation
    const validationError = new Error('Missing required fields');
    (addClass as any).mockRejectedValue(validationError);
    
    // Create invalid test data (missing name)
    const invalidClassData = {
      dateCreated: Date.now(),
      isPinned: false
    };
    
    // Call and verify that it rejects
    await expect(addClass(invalidClassData as any)).rejects.toThrow('Missing required fields');
  });

  // getClasses tests
  test('getClasses returns all classes', async () => {
    // Set up the mock data
    const mockClasses = [
      { id: 'class-1', name: 'Class 1', isPinned: false, pdfCount: 0, doneCount: 0, dateCreated: Date.now() },
      { id: 'class-2', name: 'Class 2', isPinned: true, pdfCount: 2, doneCount: 1, dateCreated: Date.now() }
    ];
    
    // Set up the mock implementation
    (getClasses as any).mockResolvedValue(mockClasses);
    
    // Call the function
    const classes = await getClasses();
    
    // Verify the result
    expect(classes).toEqual(mockClasses);
    expect(classes).toHaveLength(2);
    expect(classes[0].id).toBe('class-1');
    expect(classes[1].id).toBe('class-2');
  });

  test('getClasses returns empty array when no classes exist', async () => {
    // Set up the mock implementation to return empty array
    (getClasses as any).mockResolvedValue([]);
    
    // Call the function
    const classes = await getClasses();
    
    // Verify the result
    expect(classes).toEqual([]);
    expect(classes).toHaveLength(0);
  });

  test('getClasses handles database error', async () => {
    // Set up the mock implementation to throw an error
    const dbError = new Error('Database error');
    (getClasses as any).mockRejectedValue(dbError);
    
    // Call and verify that it rejects
    await expect(getClasses()).rejects.toThrow('Database error');
  });

  // getClass tests
  test('getClass returns a specific class', async () => {
    // Set up the mock data
    const mockClass = { 
      id: 'class-1', 
      name: 'Class 1', 
      isPinned: false, 
      pdfCount: 0, 
      doneCount: 0, 
      dateCreated: Date.now(),
      notes: ''
    };
    
    // Set up the mock implementation
    (getClass as any).mockResolvedValue(mockClass);
    
    // Call the function
    const cls = await getClass('class-1');
    
    // Verify the result
    expect(cls).toEqual(mockClass);
    
    // Verify that the function was called with correct parameters
    expect(getClass).toHaveBeenCalledWith('class-1');
  });

  test('getClass with non-existent class ID', async () => {
    // Set up the mock implementation to return null
    (getClass as any).mockResolvedValue(null);
    
    // Call the function
    const cls = await getClass('non-existent-id');
    
    // Verify the result
    expect(cls).toBeNull();
    expect(getClass).toHaveBeenCalledWith('non-existent-id');
  });
  
  test('getClass handles database error', async () => {
    // Set up the mock implementation to throw an error
    const dbError = new Error('Database error');
    (getClass as any).mockRejectedValue(dbError);
    
    // Call and verify that it rejects
    await expect(getClass('class-1')).rejects.toThrow('Database error');
  });

  // getPDF tests
  test('getPDF returns a specific PDF', async () => {
    // Set up the mock data
    const mockPDF = { 
      id: 1, 
      name: 'Test PDF',
      dateAdded: Date.now(),
      size: 1024,
      status: 'to-study' as const,
      classId: 'class-1',
      orderIndex: 0,
      data: new ArrayBuffer(0),
      lastModified: Date.now() 
    };
    
    // Set up the mock implementation
    (getPDF as any).mockResolvedValue(mockPDF);
    
    // Call the function
    const pdf = await getPDF(1);
    
    // Verify the result
    expect(pdf).toEqual(mockPDF);
    
    // Verify that the function was called with correct parameters
    expect(getPDF).toHaveBeenCalledWith(1);
  });

  test('getPDF with non-existent PDF ID', async () => {
    // Set up the mock implementation to return null
    (getPDF as any).mockResolvedValue(null);
    
    // Call the function
    const pdf = await getPDF(999);
    
    // Verify the result
    expect(pdf).toBeNull();
    expect(getPDF).toHaveBeenCalledWith(999);
  });

  test('getPDF handles database error', async () => {
    // Set up the mock implementation to throw an error
    const dbError = new Error('Database error');
    (getPDF as any).mockRejectedValue(dbError);
    
    // Call and verify that it rejects
    await expect(getPDF(1)).rejects.toThrow('Database error');
  });

  // updateClass tests
  test('updateClass updates an existing class', async () => {
    // Set up the mock implementation
    (updateClass as any).mockResolvedValue(undefined);
    
    // Create test data
    const updates = { 
      name: 'Updated Class Name', 
      isPinned: true 
    };
    
    // Call the function
    await updateClass('class-1', updates);
    
    // Verify that the function was called with correct parameters
    expect(updateClass).toHaveBeenCalledWith('class-1', updates);
  });

  test('updateClass with non-existent class ID', async () => {
    // Set up the mock implementation to throw a not found error
    const notFoundError = new Error('Class not found');
    (updateClass as any).mockRejectedValue(notFoundError);
    
    // Create test data
    const updates = { name: 'Updated Name' };
    
    // Call and verify that it rejects
    await expect(updateClass('non-existent-id', updates)).rejects.toThrow('Class not found');
  });
  
  test('updateClass with empty updates object', async () => {
    // Set up the mock implementation
    (updateClass as any).mockResolvedValue(undefined);
    
    // Call the function with empty updates
    await updateClass('class-1', {});
    
    // Verify that the function was called with correct parameters
    expect(updateClass).toHaveBeenCalledWith('class-1', {});
  });

  test('updateClass handles database error', async () => {
    // Set up the mock implementation to throw an error
    const dbError = new Error('Database transaction failed');
    (updateClass as any).mockRejectedValue(dbError);
    
    // Create test data
    const updates = { name: 'Updated Name' };
    
    // Call and verify that it rejects
    await expect(updateClass('class-1', updates)).rejects.toThrow('Database transaction failed');
  });

  // deleteClass tests
  test('deleteClass deletes a class and its PDFs', async () => {
    // Set up the mock implementation
    (deleteClass as any).mockResolvedValue(undefined);
    
    // Call the function
    await deleteClass('class-to-delete');
    
    // Verify that the function was called with correct parameters
    expect(deleteClass).toHaveBeenCalledWith('class-to-delete');
  });

  test('deleteClass with non-existent class ID', async () => {
    // Set up the mock implementation to throw a not found error
    const notFoundError = new Error('Class not found');
    (deleteClass as any).mockRejectedValue(notFoundError);
    
    // Call and verify that it rejects
    await expect(deleteClass('non-existent-id')).rejects.toThrow('Class not found');
  });

  test('deleteClass handles database error', async () => {
    // Set up the mock implementation to throw an error
    const dbError = new Error('Database transaction failed');
    (deleteClass as any).mockRejectedValue(dbError);
    
    // Call and verify that it rejects
    await expect(deleteClass('class-1')).rejects.toThrow('Database transaction failed');
  });

  // addPDF tests
  test('addPDF adds a new PDF and updates class counters', async () => {
    // Set up the mock implementation
    (addPDF as any).mockResolvedValue(1); // Return PDF ID 1
    
    // Create test data
    const pdfData = {
      name: 'Test PDF',
      dateAdded: Date.now(),
      size: 1024,
      status: 'to-study' as const,
      classId: 'class-1',
      orderIndex: 0,
      data: new ArrayBuffer(0),
      lastModified: Date.now()
    };
    
    // Call the function
    const id = await addPDF(pdfData);
    
    // Verify the result
    expect(id).toBe(1);
    
    // Verify that the function was called with correct parameters
    expect(addPDF).toHaveBeenCalledWith(pdfData);
  });

  test('addPDF with missing required fields', async () => {
    // Set up the mock implementation to throw an error
    const validationError = new Error('Missing required fields');
    (addPDF as any).mockRejectedValue(validationError);
    
    // Create invalid test data (missing name)
    const invalidPDFData = {
      dateAdded: Date.now(),
      size: 1024,
      status: 'to-study' as const,
      classId: 'class-1',
      data: new ArrayBuffer(0)
    };
    
    // Call and verify that it rejects
    await expect(addPDF(invalidPDFData as any)).rejects.toThrow('Missing required fields');
  });

  test('addPDF with non-existent class ID', async () => {
    // Set up the mock implementation to throw a not found error
    const notFoundError = new Error('Class not found');
    (addPDF as any).mockRejectedValue(notFoundError);
    
    // Create test data with non-existent class ID
    const pdfData = {
      name: 'Test PDF',
      dateAdded: Date.now(),
      size: 1024,
      status: 'to-study' as const,
      classId: 'non-existent-class-id',
      orderIndex: 0,
      data: new ArrayBuffer(0),
      lastModified: Date.now()
    };
    
    // Call and verify that it rejects
    await expect(addPDF(pdfData)).rejects.toThrow('Class not found');
  });

  test('addPDF handles database error', async () => {
    // Set up the mock implementation to throw an error
    const dbError = new Error('Database transaction failed');
    (addPDF as any).mockRejectedValue(dbError);
    
    // Create test data
    const pdfData = {
      name: 'Test PDF',
      dateAdded: Date.now(),
      size: 1024,
      status: 'to-study' as const,
      classId: 'class-1',
      orderIndex: 0,
      data: new ArrayBuffer(0),
      lastModified: Date.now()
    };
    
    // Call and verify that it rejects
    await expect(addPDF(pdfData)).rejects.toThrow('Database transaction failed');
  });

  // getClassPDFs tests
  test('getClassPDFs returns PDFs for a specific class', async () => {
    // Set up the mock data
    const mockPDFs = [
      { id: 2, name: 'PDF 2', classId: 'class-1', orderIndex: 0 },
      { id: 1, name: 'PDF 1', classId: 'class-1', orderIndex: 1 }
    ];
    
    // Set up the mock implementation
    (getClassPDFs as any).mockResolvedValue(mockPDFs);
    
    // Call the function
    const pdfs = await getClassPDFs('class-1');
    
    // Verify the result
    expect(pdfs).toHaveLength(2);
    expect(pdfs[0].id).toBe(2); // orderIndex 0 should come first
    expect(pdfs[1].id).toBe(1); // orderIndex 1 should come second
    
    // Verify that the function was called with correct parameters
    expect(getClassPDFs).toHaveBeenCalledWith('class-1');
  });

  test('getClassPDFs with non-existent class ID', async () => {
    // Set up the mock implementation to return empty array
    (getClassPDFs as any).mockResolvedValue([]);
    
    // Call the function
    const pdfs = await getClassPDFs('non-existent-id');
    
    // Verify the result
    expect(pdfs).toEqual([]);
    expect(pdfs).toHaveLength(0);
    
    // Verify that the function was called with correct parameters
    expect(getClassPDFs).toHaveBeenCalledWith('non-existent-id');
  });

  test('getClassPDFs with class having no PDFs', async () => {
    // Set up the mock implementation to return empty array
    (getClassPDFs as any).mockResolvedValue([]);
    
    // Call the function
    const pdfs = await getClassPDFs('empty-class');
    
    // Verify the result
    expect(pdfs).toEqual([]);
    expect(pdfs).toHaveLength(0);
  });

  test('getClassPDFs handles database error', async () => {
    // Set up the mock implementation to throw an error
    const dbError = new Error('Database error');
    (getClassPDFs as any).mockRejectedValue(dbError);
    
    // Call and verify that it rejects
    await expect(getClassPDFs('class-1')).rejects.toThrow('Database error');
  });

  // updatePDFStatus tests
  test('updatePDFStatus updates PDF status and class counters', async () => {
    // Set up the mock implementation
    (updatePDFStatus as any).mockResolvedValue(undefined);
    
    // Call the function
    await updatePDFStatus(1, 'done');
    
    // Verify that the function was called with correct parameters
    expect(updatePDFStatus).toHaveBeenCalledWith(1, 'done');
  });

  test('updatePDFStatus with non-existent PDF ID', async () => {
    // Set up the mock implementation to throw a not found error
    const notFoundError = new Error('PDF not found');
    (updatePDFStatus as any).mockRejectedValue(notFoundError);
    
    // Call and verify that it rejects
    await expect(updatePDFStatus(999, 'done')).rejects.toThrow('PDF not found');
  });

  test('updatePDFStatus with invalid status value', async () => {
    // Set up the mock implementation to throw a validation error
    const validationError = new Error('Invalid status value');
    (updatePDFStatus as any).mockRejectedValue(validationError);
    
    // Call and verify that it rejects with invalid status
    await expect(updatePDFStatus(1, 'invalid-status' as any)).rejects.toThrow('Invalid status value');
  });

  test('updatePDFStatus handles database error', async () => {
    // Set up the mock implementation to throw an error
    const dbError = new Error('Database transaction failed');
    (updatePDFStatus as any).mockRejectedValue(dbError);
    
    // Call and verify that it rejects
    await expect(updatePDFStatus(1, 'done')).rejects.toThrow('Database transaction failed');
  });

  // deletePDF tests
  test('deletePDF deletes a PDF and updates class counters', async () => {
    // Set up the mock implementation
    (deletePDF as any).mockResolvedValue(undefined);
    
    // Call the function
    await deletePDF(2);
    
    // Verify that the function was called with correct parameters
    expect(deletePDF).toHaveBeenCalledWith(2);
  });

  test('deletePDF with non-existent PDF ID', async () => {
    // Set up the mock implementation to throw a not found error
    const notFoundError = new Error('PDF not found');
    (deletePDF as any).mockRejectedValue(notFoundError);
    
    // Call and verify that it rejects
    await expect(deletePDF(999)).rejects.toThrow('PDF not found');
  });

  test('deletePDF handles database error', async () => {
    // Set up the mock implementation to throw a database error
    const dbError = new Error('Database transaction failed');
    (deletePDF as any).mockRejectedValue(dbError);
    
    // Call and verify that it rejects
    await expect(deletePDF(3)).rejects.toThrow('Database transaction failed');
  });

  // updateMultiplePDFOrders tests
  test('updateMultiplePDFOrders updates PDF orders', async () => {
    // Set up the mock implementation
    (updateMultiplePDFOrders as any).mockResolvedValue(undefined);
    
    // Create test data
    const updates = [
      { id: 1, orderIndex: 1 },
      { id: 2, orderIndex: 0 }
    ];
    
    // Call the function
    await updateMultiplePDFOrders(updates);
    
    // Verify that the function was called with correct parameters
    expect(updateMultiplePDFOrders).toHaveBeenCalledWith(updates);
  });

  test('updateMultiplePDFOrders with empty updates array', async () => {
    // Set up the mock implementation
    (updateMultiplePDFOrders as any).mockResolvedValue(undefined);
    
    // Call the function with empty updates array
    await updateMultiplePDFOrders([]);
    
    // Verify that the function was called with empty array
    expect(updateMultiplePDFOrders).toHaveBeenCalledWith([]);
  });

  test('updateMultiplePDFOrders with invalid PDF IDs', async () => {
    // Set up the mock implementation to throw an error
    const validationError = new Error('Invalid PDF IDs');
    (updateMultiplePDFOrders as any).mockRejectedValue(validationError);
    
    // Create test data with invalid IDs
    const updates = [
      { id: 999, orderIndex: 0 },
      { id: 888, orderIndex: 1 }
    ];
    
    // Call and verify that it rejects
    await expect(updateMultiplePDFOrders(updates)).rejects.toThrow('Invalid PDF IDs');
  });

  test('updateMultiplePDFOrders handles database error', async () => {
    // Set up the mock implementation to throw an error
    const dbError = new Error('Database transaction failed');
    (updateMultiplePDFOrders as any).mockRejectedValue(dbError);
    
    // Create test data
    const updates = [
      { id: 1, orderIndex: 1 },
      { id: 2, orderIndex: 0 }
    ];
    
    // Call and verify that it rejects
    await expect(updateMultiplePDFOrders(updates)).rejects.toThrow('Database transaction failed');
  });
});
