// src/App.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Song, Playlist } from './types';
import {
  getAllSongs,
  addSong as addSongToDB,
  deleteSongFromDB,
  updateSong,
  getAllPlaylists,
  addPlaylist,
  deletePlaylist,
  ensureDefaultPlaylist,
  DEFAULT_PLAYLIST_ID,
} from './utils/db';
import { getSettings, saveSettings } from './utils/settings';
import { exportToZip, importFromZip } from './utils/export';
import { Header } from './components/Header';
import { LibraryPanel } from './components/LibraryPanel';
import { MusicPlayer } from './components/MusicPlayer';
import { Footer } from './components/Footer';

export default function App() {
  // Load settings from localStorage
  const initialSettings = getSettings();

  // State for song list, current song, playback status, etc.
  const [songs, setSongs] = useState<Song[]>([]);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [showLibrary, setShowLibrary] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // New feature states
  const [isShuffled, setIsShuffled] = useState<boolean>(initialSettings.isShuffled);
  const [normalizeAudio, setNormalizeAudio] = useState<boolean>(initialSettings.normalizeAudio);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [currentPlaylistId, setCurrentPlaylistId] = useState<string | null>(
    initialSettings.currentPlaylistId || DEFAULT_PLAYLIST_ID
  );

  // References
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);

  // Get songs filtered by current playlist
  const filteredSongs = currentPlaylistId
    ? songs.filter(s => s.playlistId === currentPlaylistId)
    : songs;

  // Load songs and playlists from IndexedDB on initial render
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);

        // Ensure default playlist exists
        await ensureDefaultPlaylist();

        // Load playlists and songs
        const [dbPlaylists, dbSongs] = await Promise.all([
          getAllPlaylists(),
          getAllSongs(),
        ]);

        setPlaylists(dbPlaylists);
        setSongs(dbSongs);

        // Migrate songs without playlistId to default playlist in DB
        const songsToMigrate = dbSongs.filter(s => s.playlistId === DEFAULT_PLAYLIST_ID);
        for (const song of songsToMigrate) {
          if (song.file instanceof Blob || song.file instanceof ArrayBuffer) {
            await updateSong({ ...song, playlistId: DEFAULT_PLAYLIST_ID });
          }
        }

        // If we have songs and no current song, set the first one from current playlist
        const playlistSongs = dbSongs.filter(
          s => s.playlistId === (initialSettings.currentPlaylistId || DEFAULT_PLAYLIST_ID)
        );
        if (playlistSongs.length > 0 && !currentSong) {
          setCurrentSong(playlistSongs[0]);
        }
      } catch (error) {
        console.error("Failed to load data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();

    // Clean up object URLs when component unmounts
    return () => {
      songs.forEach(song => {
        if (song.url && song.url.startsWith('blob:')) {
          URL.revokeObjectURL(song.url);
        }
      });
    };
  }, []);

  // Setup Web Audio API for normalization
  useEffect(() => {
    if (!audioRef.current) return;

    const setupAudioContext = () => {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }

      const audio = audioRef.current!;
      const ctx = audioContextRef.current;

      // Only create source node once
      if (!sourceNodeRef.current) {
        sourceNodeRef.current = ctx.createMediaElementSource(audio);
        gainNodeRef.current = ctx.createGain();
        sourceNodeRef.current.connect(gainNodeRef.current);
        gainNodeRef.current.connect(ctx.destination);
      }
    };

    // Setup on first user interaction
    const handleInteraction = () => {
      setupAudioContext();
      document.removeEventListener('click', handleInteraction);
    };

    document.addEventListener('click', handleInteraction);

    return () => {
      document.removeEventListener('click', handleInteraction);
    };
  }, []);

  // Update gain based on normalize setting
  useEffect(() => {
    if (gainNodeRef.current) {
      // When normalizing, we boost quieter audio (this is a simple approach)
      // A more sophisticated approach would analyze the audio first
      gainNodeRef.current.gain.value = normalizeAudio ? 1.5 : 1.0;
    }
  }, [normalizeAudio]);

  // Play/pause logic
  useEffect(() => {
    if (!audioRef.current || !currentSong) return;

    const audio = audioRef.current;

    if (isPlaying) {
      // Resume audio context if suspended
      if (audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume();
      }

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
            artist: "You gotta lock in",
            duration,
            file, // Store the actual file
            url: blobUrl, // Store the playable URL
            playlistId: currentPlaylistId || DEFAULT_PLAYLIST_ID,
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

  // Play the next song (with shuffle support)
  const playNextSong = useCallback(() => {
    if (filteredSongs.length === 0) return;

    if (isShuffled) {
      // Pick a random song (different from current if possible)
      let randomIndex: number;
      if (filteredSongs.length === 1) {
        randomIndex = 0;
      } else {
        const currentIndex = currentSong
          ? filteredSongs.findIndex(song => song.id === currentSong.id)
          : -1;
        do {
          randomIndex = Math.floor(Math.random() * filteredSongs.length);
        } while (randomIndex === currentIndex);
      }
      setCurrentSong(filteredSongs[randomIndex]);
    } else {
      const currentIndex = currentSong
        ? filteredSongs.findIndex(song => song.id === currentSong.id)
        : -1;

      const nextIndex = (currentIndex + 1) % filteredSongs.length;
      setCurrentSong(filteredSongs[nextIndex]);
    }
    setIsPlaying(true);
  }, [filteredSongs, currentSong, isShuffled]);

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
  }, [playNextSong]); 

  // Play the previous song
  const playPrevSong = useCallback(() => {
    if (filteredSongs.length === 0) return;

    // If we're more than 3 seconds into the song, restart it
    if (audioRef.current && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      return;
    }

    const currentIndex = currentSong
      ? filteredSongs.findIndex(song => song.id === currentSong.id)
      : -1;

    const prevIndex = (currentIndex - 1 + filteredSongs.length) % filteredSongs.length;
    setCurrentSong(filteredSongs[prevIndex]);
    setIsPlaying(true);
  }, [filteredSongs, currentSong]);

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

  // Toggle shuffle mode
  const toggleShuffle = useCallback(() => {
    const newValue = !isShuffled;
    setIsShuffled(newValue);
    saveSettings({ isShuffled: newValue });
  }, [isShuffled]);

  // Toggle audio normalization
  const toggleNormalize = useCallback(() => {
    const newValue = !normalizeAudio;
    setNormalizeAudio(newValue);
    saveSettings({ normalizeAudio: newValue });
  }, [normalizeAudio]);

  // Change playlist
  const changePlaylist = useCallback((playlistId: string) => {
    setCurrentPlaylistId(playlistId);
    saveSettings({ currentPlaylistId: playlistId });

    // Set first song of new playlist as current
    const playlistSongs = songs.filter(s => s.playlistId === playlistId);
    if (playlistSongs.length > 0) {
      setCurrentSong(playlistSongs[0]);
      setIsPlaying(false);
    } else {
      setCurrentSong(null);
      setIsPlaying(false);
    }
  }, [songs]);

  // Create new playlist
  const createPlaylist = useCallback(async (name: string) => {
    const newPlaylist: Playlist = {
      id: crypto.randomUUID(),
      name,
      createdAt: Date.now(),
    };
    await addPlaylist(newPlaylist);
    setPlaylists(prev => [...prev, newPlaylist]);
    return newPlaylist;
  }, []);

  // Delete a playlist
  const removePlaylist = useCallback(async (playlistId: string) => {
    // Don't delete the default playlist
    if (playlistId === DEFAULT_PLAYLIST_ID) return;

    await deletePlaylist(playlistId);
    setPlaylists(prev => prev.filter(p => p.id !== playlistId));

    // Move songs from deleted playlist to default
    const songsToMove = songs.filter(s => s.playlistId === playlistId);
    for (const song of songsToMove) {
      const updatedSong = { ...song, playlistId: DEFAULT_PLAYLIST_ID };
      await updateSong(updatedSong);
    }
    setSongs(prev => prev.map(s =>
      s.playlistId === playlistId ? { ...s, playlistId: DEFAULT_PLAYLIST_ID } : s
    ));

    // Switch to default playlist if current was deleted
    if (currentPlaylistId === playlistId) {
      changePlaylist(DEFAULT_PLAYLIST_ID);
    }
  }, [songs, currentPlaylistId, changePlaylist]);

  // Move song to different playlist
  const moveSongToPlaylist = useCallback(async (songId: string, playlistId: string) => {
    const song = songs.find(s => s.id === songId);
    if (!song) return;

    const updatedSong = { ...song, playlistId };
    await updateSong(updatedSong);
    setSongs(prev => prev.map(s => s.id === songId ? { ...s, playlistId } : s));
  }, [songs]);

  // Export all songs to ZIP
  const handleExport = useCallback(async () => {
    if (songs.length === 0) return;
    setIsLoading(true);
    try {
      await exportToZip(songs, playlists);
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setIsLoading(false);
    }
  }, [songs, playlists]);

  // Import from ZIP
  const handleImportZip = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    try {
      const { songs: importedSongs, playlists: importedPlaylists } = await importFromZip(file);

      // Add imported playlists
      for (const playlist of importedPlaylists) {
        const exists = playlists.some(p => p.id === playlist.id);
        if (!exists) {
          await addPlaylist(playlist);
          setPlaylists(prev => [...prev, playlist]);
        }
      }

      // Add imported songs
      for (const songData of importedSongs) {
        const blobUrl = URL.createObjectURL(songData.file);
        const audio = new Audio(blobUrl);

        const duration = await new Promise<number>((resolve) => {
          const timeoutId = setTimeout(() => resolve(0), 3000);
          audio.onloadedmetadata = () => {
            clearTimeout(timeoutId);
            resolve(audio.duration || 0);
          };
        });

        const newSong: Song = {
          id: crypto.randomUUID(),
          title: songData.title,
          artist: "You gotta lock in",
          duration,
          file: songData.file,
          url: blobUrl,
          playlistId: songData.playlistId || DEFAULT_PLAYLIST_ID,
        };

        await addSongToDB(newSong, songData.file);
        setSongs(prev => [...prev, newSong]);
      }
    } catch (error) {
      console.error("Import failed:", error);
    } finally {
      setIsLoading(false);
      e.target.value = '';
    }
  }, [playlists]);

  return (
    <div className="min-h-screen w-full bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <Header
        showLibrary={showLibrary}
        setShowLibrary={setShowLibrary}
        isLoading={isLoading}
        handleFileUpload={handleFileUpload}
        isShuffled={isShuffled}
        toggleShuffle={toggleShuffle}
        normalizeAudio={normalizeAudio}
        toggleNormalize={toggleNormalize}
        playlists={playlists}
        currentPlaylistId={currentPlaylistId}
        changePlaylist={changePlaylist}
        createPlaylist={createPlaylist}
        removePlaylist={removePlaylist}
        handleExport={handleExport}
        handleImportZip={handleImportZip}
        defaultPlaylistId={DEFAULT_PLAYLIST_ID}
      />

      {/* Main content */}
      <main className="flex-1 flex flex-col md:flex-row p-4 gap-4">
        {/* Audio element (hidden) */}
        {currentSong && (
          <audio 
            ref={audioRef} 
            src={
              currentSong.url || 
              (typeof currentSong.file === 'string' ? currentSong.file : "")
            }
            key={currentSong.id}
          />
        )}
        
        {/* Library panel (conditionally shown) */}
        {showLibrary && (
          <LibraryPanel
            songs={filteredSongs}
            currentSong={currentSong}
            isLoading={isLoading}
            playSong={playSong}
            deleteSong={deleteSong}
            playlists={playlists}
            currentPlaylistId={currentPlaylistId}
            moveSongToPlaylist={moveSongToPlaylist}
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