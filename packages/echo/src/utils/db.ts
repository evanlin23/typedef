// src/utils/db.ts
import type { Song } from '../types';

// Database configuration
const DB_NAME = 'echo-player-db';
const DB_VERSION = 1;
const SONGS_STORE = 'songs';

// Cached database connection
let dbCache: IDBDatabase | null = null;

// IndexedDB helper functions
export const initDB = async (): Promise<IDBDatabase> => {
  // Return cached connection if available
  if (dbCache) return dbCache;
  
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = (event: Event) => {
      console.error("IndexedDB error:", event);
      reject(new Error("Error opening database"));
    };
    
    request.onsuccess = () => {
      dbCache = request.result;
      resolve(request.result);
    };
    
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SONGS_STORE)) {
        // Store the audio file data as a blob in the database
        db.createObjectStore(SONGS_STORE, { keyPath: 'id' });
      }
    };
  });
};

export const getAllSongs = async (): Promise<Song[]> => {
  try {
    const db = await initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(SONGS_STORE, 'readonly');
      const store = transaction.objectStore(SONGS_STORE);
      const request = store.getAll();
      
      request.onsuccess = () => {
        const songs = request.result as Song[];
        
        // Create blob URLs for each song's file data
        const songsWithBlobUrls = songs.map(song => {
          // If the file is already a blob URL, use it for both file and url
          if (typeof song.file === 'string' && song.file.startsWith('blob:')) {
            return {
              ...song,
              url: song.file
            };
          }
          
          // If the file is stored as a Blob or ArrayBuffer, create a blob URL
          if (song.file instanceof Blob || song.file instanceof ArrayBuffer) {
            const blob = song.file instanceof ArrayBuffer 
              ? new Blob([song.file], { type: 'audio/mpeg' }) 
              : song.file;
            
            return {
              ...song,
              url: URL.createObjectURL(blob)
            };
          }
          
          return song;
        });
        
        resolve(songsWithBlobUrls);
      };
      
      request.onerror = (event: Event) => {
        console.error("Error fetching songs:", event);
        reject(new Error("Could not fetch songs"));
      };
    });
  } catch (error) {
    console.error("Database connection error:", error);
    return [];
  }
};

export const addSong = async (song: Song, fileData?: Blob): Promise<Song> => {
  try {
    const db = await initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(SONGS_STORE, 'readwrite');
      const store = transaction.objectStore(SONGS_STORE);
      
      // If fileData is provided, add it to the song object
      const songToStore = fileData ? {
        ...song,
        // Store the actual blob data instead of the URL
        file: fileData
      } : song;
      
      const request = store.add(songToStore);
      
      request.onsuccess = () => {
        resolve(song);
      };
      
      request.onerror = (event: Event) => {
        console.error("Error adding song:", event);
        reject(new Error("Could not add song"));
      };
    });
  } catch (error) {
    console.error("Database connection error:", error);
    throw error;
  }
};

export const deleteSongFromDB = async (id: string): Promise<boolean> => {
  try {
    const db = await initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(SONGS_STORE, 'readwrite');
      const store = transaction.objectStore(SONGS_STORE);
      const request = store.delete(id);
      
      request.onsuccess = () => {
        resolve(true);
      };
      
      request.onerror = (event: Event) => {
        console.error("Error deleting song:", event);
        reject(new Error("Could not delete song"));
      };
    });
  } catch (error) {
    console.error("Database connection error:", error);
    return false;
  }
};