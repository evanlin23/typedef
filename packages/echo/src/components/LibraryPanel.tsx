// src/components/LibraryPanel.tsx
import React, { useState } from 'react';
import type { Song, Playlist } from '../types';
import { formatTime } from '../utils/formatTime';

interface LibraryPanelProps {
  songs: Song[];
  currentSong: Song | null;
  isLoading: boolean;
  playSong: (song: Song) => void;
  deleteSong: (id: string) => void;
  playlists: Playlist[];
  currentPlaylistId: string | null;
  moveSongToPlaylist: (songId: string, playlistId: string) => void;
}

export const LibraryPanel: React.FC<LibraryPanelProps> = ({
  songs,
  currentSong,
  isLoading,
  playSong,
  deleteSong,
  playlists,
  currentPlaylistId,
  moveSongToPlaylist,
}) => {
  const [moveMenuSongId, setMoveMenuSongId] = useState<string | null>(null);

  return (
    <div className="w-full md:w-1/3 lg:w-1/4 bg-gray-800 rounded-lg p-4 overflow-y-auto max-h-[70vh] md:max-h-full">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Your Library</h2>
        <span className="text-sm text-gray-400">{songs.length} songs</span>
      </div>

      {isLoading ? (
        <div className="text-center p-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
          <p className="mt-2 text-gray-400">Loading songs...</p>
        </div>
      ) : songs.length === 0 ? (
        <p className="text-center text-gray-400 p-4">
          Your library is empty. Upload some songs to get started!
        </p>
      ) : (
        <ul className="space-y-2">
          {songs.map(song => (
            <li
              key={song.id}
              className={`p-3 rounded-md cursor-pointer hover:bg-gray-700 transition-colors ${
                currentSong?.id === song.id ? 'bg-gray-700' : ''
              }`}
              onClick={() => playSong(song)}
            >
              <div className="flex justify-between items-center">
                <div className="overflow-hidden flex-1 min-w-0">
                  <p className="font-medium truncate">{song.title}</p>
                  <p className="text-sm text-gray-400 truncate">{song.artist}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <span className="text-xs text-gray-400">
                    {formatTime(song.duration)}
                  </span>
                  {/* Move to playlist button */}
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMoveMenuSongId(moveMenuSongId === song.id ? null : song.id);
                      }}
                      className="p-1 rounded-full hover:bg-gray-600 transition-colors"
                      title="Move to playlist"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" />
                      </svg>
                    </button>
                    {moveMenuSongId === song.id && (
                      <div className="absolute right-0 top-full mt-1 w-40 bg-gray-900 rounded-lg shadow-lg border border-gray-700 z-50">
                        <div className="py-1 text-sm">
                          <p className="px-3 py-1 text-gray-400 text-xs">Move to:</p>
                          {playlists
                            .filter(p => p.id !== currentPlaylistId)
                            .map(playlist => (
                              <button
                                key={playlist.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  moveSongToPlaylist(song.id, playlist.id);
                                  setMoveMenuSongId(null);
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-gray-700"
                              >
                                {playlist.name}
                              </button>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSong(song.id);
                    }}
                    className="p-1 rounded-full hover:bg-red-600 hover:text-white transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};