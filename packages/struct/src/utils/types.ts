// src/utils/types.ts
export type PDF = {
  id?: number; // PDF IDs can remain auto-incrementing numbers for their own store
  name: string;
  size: number;
  lastModified: number;
  data?: ArrayBuffer;
  status: 'to-study' | 'done';
  dateAdded: number;
  classId: string; // Changed: Class ID is now a string (UUID)
  orderIndex?: number;
};

export interface Class {
  id: string; // Changed: ID is now a string (UUID) and always present
  name: string;
  dateCreated: number;
  pdfCount: number;
  doneCount?: number;
  isPinned?: boolean;
  notes: string;

  // Client-side calculated properties for display
  progress?: number;
  completedItems?: number;
  totalItems?: number;
}