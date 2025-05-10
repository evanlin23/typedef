// src/types/index.ts
export interface Song {
  id: string;
  title: string;
  artist: string;
  duration: number;
  file: string | Blob | ArrayBuffer;
  url?: string;
}
