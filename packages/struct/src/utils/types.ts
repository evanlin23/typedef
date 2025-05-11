// utils/types.ts
export type PDF = {
  id?: number;
  name: string;
  size: number;
  lastModified: number;
  data: ArrayBuffer;
  status: 'to-study' | 'done';
  dateAdded: number;
  classId: number;
}

export interface Class {
  id?: number;
  name: string;
  dateCreated: number;
  pdfCount: number;
  isPinned?: boolean;
  doneCount?: number;
  progress?: number;
  completedItems?: number;
  totalItems?: number;
}