// src/utils/db.ts
import type { Song, Playlist } from '../types';

// Database configuration
const DB_NAME = 'echo-player-db';
const DB_VERSION = 2;
const SONGS_STORE = 'songs';
const PLAYLISTS_STORE = 'playlists';

// Cached database connection
let dbCache: IDBDatabase | null = null;

// IndexedDB helper functions
export const initDB = async (): Promise<IDBDatabase> => {
  // Return cached connection if available and version matches
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

    request.onupgradeneeded = (event) => {
      const db = request.result;
      const oldVersion = event.oldVersion;

      // Version 1: songs store
      if (oldVersion < 1) {
        if (!db.objectStoreNames.contains(SONGS_STORE)) {
          db.createObjectStore(SONGS_STORE, { keyPath: 'id' });
        }
      }

      // Version 2: playlists store + playlistId index on songs
      if (oldVersion < 2) {
        if (!db.objectStoreNames.contains(PLAYLISTS_STORE)) {
          db.createObjectStore(PLAYLISTS_STORE, { keyPath: 'id' });
        }
      }
    };
  });
};

// Default playlist ID for migrating existing songs
export const DEFAULT_PLAYLIST_ID = 'playlist-1';
export const DEFAULT_PLAYLIST_NAME = 'Playlist 1';

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
          let updatedSong = { ...song };

          // If the file is already a blob URL, use it for both file and url
          if (typeof song.file === 'string' && song.file.startsWith('blob:')) {
            updatedSong.url = song.file;
          } else if (song.file instanceof Blob || song.file instanceof ArrayBuffer) {
            // If the file is stored as a Blob or ArrayBuffer, create a blob URL
            const blob = song.file instanceof ArrayBuffer
              ? new Blob([song.file], { type: 'audio/mpeg' })
              : song.file;
            updatedSong.url = URL.createObjectURL(blob);
          }

          // Migrate songs without playlistId to default playlist
          if (updatedSong.playlistId === undefined) {
            updatedSong.playlistId = DEFAULT_PLAYLIST_ID;
          }

          return updatedSong;
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

// Ensure default playlist exists
export const ensureDefaultPlaylist = async (): Promise<void> => {
  try {
    const playlists = await getAllPlaylists();
    const hasDefault = playlists.some(p => p.id === DEFAULT_PLAYLIST_ID);

    if (!hasDefault) {
      await addPlaylist({
        id: DEFAULT_PLAYLIST_ID,
        name: DEFAULT_PLAYLIST_NAME,
        createdAt: Date.now(),
      });
    }
  } catch (error) {
    console.error("Error ensuring default playlist:", error);
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

export const updateSong = async (song: Song): Promise<Song> => {
  try {
    const db = await initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(SONGS_STORE, 'readwrite');
      const store = transaction.objectStore(SONGS_STORE);
      const request = store.put(song);

      request.onsuccess = () => {
        resolve(song);
      };

      request.onerror = (event: Event) => {
        console.error("Error updating song:", event);
        reject(new Error("Could not update song"));
      };
    });
  } catch (error) {
    console.error("Database connection error:", error);
    throw error;
  }
};

// Playlist functions
export const getAllPlaylists = async (): Promise<Playlist[]> => {
  try {
    const db = await initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(PLAYLISTS_STORE, 'readonly');
      const store = transaction.objectStore(PLAYLISTS_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        const playlists = request.result as Playlist[];
        // Sort by creation date
        playlists.sort((a, b) => a.createdAt - b.createdAt);
        resolve(playlists);
      };

      request.onerror = (event: Event) => {
        console.error("Error fetching playlists:", event);
        reject(new Error("Could not fetch playlists"));
      };
    });
  } catch (error) {
    console.error("Database connection error:", error);
    return [];
  }
};

export const addPlaylist = async (playlist: Playlist): Promise<Playlist> => {
  try {
    const db = await initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(PLAYLISTS_STORE, 'readwrite');
      const store = transaction.objectStore(PLAYLISTS_STORE);
      const request = store.add(playlist);

      request.onsuccess = () => {
        resolve(playlist);
      };

      request.onerror = (event: Event) => {
        console.error("Error adding playlist:", event);
        reject(new Error("Could not add playlist"));
      };
    });
  } catch (error) {
    console.error("Database connection error:", error);
    throw error;
  }
};

export const deletePlaylist = async (id: string): Promise<boolean> => {
  try {
    const db = await initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(PLAYLISTS_STORE, 'readwrite');
      const store = transaction.objectStore(PLAYLISTS_STORE);
      const request = store.delete(id);

      request.onsuccess = () => {
        resolve(true);
      };

      request.onerror = (event: Event) => {
        console.error("Error deleting playlist:", event);
        reject(new Error("Could not delete playlist"));
      };
    });
  } catch (error) {
    console.error("Database connection error:", error);
    return false;
  }
};