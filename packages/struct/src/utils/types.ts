// src/utils/types.ts
export type PDF = {
  id?: number; 
  name: string;
  size: number;
  lastModified: number;
  data: ArrayBuffer;
  status: 'to-study' | 'done';
  dateAdded: number;
  classId: number; 
  orderIndex?: number; // For custom drag-and-drop ordering
};

export interface Class {
  id?: number; 
  name: string;
  dateCreated: number;
  pdfCount: number; 
  doneCount?: number; 
  isPinned?: boolean;
  notes?: string; // Notes specific to this class

  // Client-side calculated properties for display
  progress?: number; 
  completedItems?: number; 
  totalItems?: number; 
}