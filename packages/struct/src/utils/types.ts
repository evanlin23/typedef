export type PDF = {
  id?: number;
  name: string;
  size: number;
  lastModified: number;
  data: ArrayBuffer;
  status: 'to-study' | 'done';
  dateAdded: number;
  classId?: number;
}

export type Class = {
  id?: number;
  name: string;
  dateCreated: number;
  pdfCount: number;
}