// src/utils/types.ts
export type PDF = {
  id?: number; // Auto-incremented by IndexedDB
  name: string;
  size: number;
  lastModified: number;
  data: ArrayBuffer;
  status: 'to-study' | 'done';
  dateAdded: number;
  classId: number; // Foreign key to Class
};

export interface Class {
  id?: number; // Auto-incremented by IndexedDB
  name: string;
  dateCreated: number;
  pdfCount: number; // Total PDFs in this class
  doneCount?: number; // Number of PDFs marked as 'done'
  isPinned?: boolean;

  // Client-side calculated properties for display
  progress?: number; // Overall progress percentage
  completedItems?: number; // Alias for doneCount, for props
  totalItems?: number; // Alias for pdfCount, for props
}