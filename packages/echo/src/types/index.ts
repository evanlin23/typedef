// src/types/index.ts

/**
 * Represents a music track in the application
 */
export interface Song {
  /** Unique identifier for the song */
  id: string;
  
  /** Display title of the song */
  title: string;
  
  /** Artist name */
  artist: string;
  
  /** Duration of the song in seconds */
  duration: number;
  
  /** 
   * The actual file data - can be stored as string (URL),
   * Blob (for direct file data), or ArrayBuffer
   */
  file: string | Blob | ArrayBuffer;
  
  /** 
   * Playable URL for the song (typically a blob URL)
   * This is generally created from the file data
   */
  url?: string;
}