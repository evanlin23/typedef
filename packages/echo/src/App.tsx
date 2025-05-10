// src/App.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Song } from './types';
import { getAllSongs, addSong as addSongToDB, deleteSongFromDB } from './utils/db';
import { Header } from './components/Header';
import { LibraryPanel } from './components/LibraryPanel';
import { MusicPlayer } from './components/MusicPlayer';
import { Footer } from './components/Footer';

export default function App() {
  // State for song list, current song, playback status, etc.
  const [songs, setSongs] = useState<Song[]>([]);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [showLibrary, setShowLibrary] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  // References
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  // Load songs from IndexedDB on initial render
  useEffect(() => {
    const loadSongs = async () => {
      try {
        setIsLoading(true);
        const dbSongs = await getAllSongs();
        
        setSongs(dbSongs);
        
        // If we have songs and no current song, set the first one
        if (dbSongs.length > 0 && !currentSong) {
          setCurrentSong(dbSongs[0]);
        }
      } catch (error) {
        console.error("Failed to load songs:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadSongs();
    
    // Clean up object URLs when component unmounts
    return () => {
      songs.forEach(song => {
        if (song.url && song.url.startsWith('blob:')) {
          URL.revokeObjectURL(song.url);
        }
      });
    };
  }, []);

  // Play/pause logic
  useEffect(() => {
    if (!audioRef.current || !currentSong) return;
    
    const audio = audioRef.current;
    
    if (isPlaying) {
      // Get the playable URL
      const playableUrl = currentSong.url || 
        (typeof currentSong.file === 'string' ? currentSong.file : '');
      
      if (playableUrl && audio.src !== playableUrl) {
        audio.src = playableUrl;
      }
      
      audio.play().catch((error: Error) => {
        console.error("Playback failed:", error);
        setIsPlaying(false);
      });
    } else {
      audio.pause();
    }
  }, [isPlaying, currentSong]);

  // Update time as song plays and handle song ending
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const updateTime = () => setCurrentTime(audio.currentTime);
    const handleEnded = () => playNextSong();
    
    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('ended', handleEnded);
    
    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [/* No dependencies to avoid recreating event listeners */]);

  // Handle file upload - optimized for handling multiple files properly
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setIsLoading(true);
    
    try {
      const newSongs: Song[] = [];
      
      // Process all files in parallel for better performance
      await Promise.all(Array.from(files).map(async (file) => {
        try {
          // Create a blob URL for playback
          const blobUrl = URL.createObjectURL(file);
          
          // Create audio element to get duration
          const audio = new Audio(blobUrl);
          
          // Wait for metadata to load with a timeout fallback
          const duration = await new Promise<number>((resolve) => {
            const timeoutId = setTimeout(() => resolve(0), 3000);
            
            audio.onloadedmetadata = () => {
              clearTimeout(timeoutId);
              resolve(audio.duration || 0);
            };
          });
          
          const newSong: Song = {
            id: crypto.randomUUID(),
            title: file.name.replace(/\.[^/.]+$/, ""), // Remove file extension
            artist: "Unknown Artist",
            duration,
            file, // Store the actual file
            url: blobUrl // Store the playable URL
          };
          
          // Store in IndexedDB
          await addSongToDB(newSong, file);
          
          // Add to our new songs array
          newSongs.push(newSong);
        } catch (error) {
          console.error(`Error processing file ${file.name}:`, error);
        }
      }));
      
      if (newSongs.length > 0) {
        // Update state once with all new songs
        setSongs(prevSongs => [...prevSongs, ...newSongs]);
        
        // If no current song is selected, set the first new one
        if (!currentSong) {
          setCurrentSong(newSongs[0]);
        }
      }
    } catch (error) {
      console.error("Error uploading files:", error);
    } finally {
      setIsLoading(false);
      // Reset the input
      e.target.value = '';
    }
  }, [songs.length, currentSong]);

  // Delete a song
  const deleteSong = useCallback(async (id: string) => {
    try {
      // If the current song is being deleted, clear it
      if (currentSong?.id === id) {
        setCurrentSong(null);
        setIsPlaying(false);
      }
      
      // Find the song to get its URL
      const songToDelete = songs.find(song => song.id === id);
      if (songToDelete?.url && songToDelete.url.startsWith('blob:')) {
        URL.revokeObjectURL(songToDelete.url);
      }
      
      // Delete from IndexedDB
      await deleteSongFromDB(id);
      
      // Remove from state
      setSongs(prevSongs => prevSongs.filter(song => song.id !== id));
    } catch (error) {
      console.error("Error deleting song:", error);
    }
  }, [songs, currentSong]);

  // Play a specific song
  const playSong = useCallback((song: Song) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    
    setCurrentSong(song);
    setIsPlaying(true);
  }, []);

  // Play the next song
  const playNextSong = useCallback(() => {
    if (songs.length === 0) return;
    
    const currentIndex = currentSong 
      ? songs.findIndex(song => song.id === currentSong.id)
      : -1;
    
    const nextIndex = (currentIndex + 1) % songs.length;
    setCurrentSong(songs[nextIndex]);
    setIsPlaying(true);
  }, [songs, currentSong]);

  // Play the previous song
  const playPrevSong = useCallback(() => {
    if (songs.length === 0) return;
    
    // If we're more than 3 seconds into the song, restart it
    if (audioRef.current && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      return;
    }
    
    const currentIndex = currentSong 
      ? songs.findIndex(song => song.id === currentSong.id)
      : -1;
    
    const prevIndex = (currentIndex - 1 + songs.length) % songs.length;
    setCurrentSong(songs[prevIndex]);
    setIsPlaying(true);
  }, [songs, currentSong]);

  // Seek to a specific time in the song
  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || !audioRef.current || !currentSong) return;
    
    const progressBar = progressBarRef.current;
    const bounds = progressBar.getBoundingClientRect();
    const percent = (e.clientX - bounds.left) / bounds.width;
    const newTime = percent * currentSong.duration;
    
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  }, [currentSong]);

  return (
    <div className="min-h-screen w-full bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <Header 
        showLibrary={showLibrary}
        setShowLibrary={setShowLibrary}
        isLoading={isLoading}
        handleFileUpload={handleFileUpload}
      />

      {/* Main content */}
      <main className="flex-1 flex flex-col md:flex-row p-4 gap-4">
        {/* Audio element (hidden) */}
        <audio 
          ref={audioRef} 
          src={
            currentSong 
              ? (currentSong.url || (typeof currentSong.file === 'string' ? currentSong.file : ""))
              : ""
          }
          key={currentSong?.id || "empty"} 
        />
        
        {/* Library panel (conditionally shown) */}
        {showLibrary && (
          <LibraryPanel 
            songs={songs}
            currentSong={currentSong}
            isLoading={isLoading}
            playSong={playSong}
            deleteSong={deleteSong}
          />
        )}
        
        {/* Player card (centered when library is hidden) */}
        <div className={`flex-1 flex items-center justify-center ${showLibrary ? 'md:w-2/3 lg:w-3/4' : 'w-full'}`}>
          <div className="w-full max-w-md bg-gray-800 rounded-lg p-6 shadow-lg">
            <MusicPlayer 
              currentSong={currentSong}
              isPlaying={isPlaying}
              setIsPlaying={setIsPlaying}
              currentTime={currentTime}
              handleSeek={handleSeek}
              progressBarRef={progressBarRef}
              playPrevSong={playPrevSong}
              playNextSong={playNextSong}
              isLoading={isLoading}
            />
          </div>
        </div>
      </main>
      
      {/* Footer */}
      <Footer />
    </div>
  );
}