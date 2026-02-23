// src/components/Header.tsx
import React, { useState } from 'react';
import type { Playlist } from '../types';

interface HeaderProps {
  showLibrary: boolean;
  setShowLibrary: (show: boolean) => void;
  isLoading: boolean;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isShuffled: boolean;
  toggleShuffle: () => void;
  normalizeAudio: boolean;
  toggleNormalize: () => void;
  playlists: Playlist[];
  currentPlaylistId: string | null;
  changePlaylist: (id: string) => void;
  createPlaylist: (name: string) => Promise<Playlist>;
  removePlaylist: (id: string) => Promise<void>;
  handleExport: () => Promise<void>;
  handleImportZip: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  defaultPlaylistId: string;
}

export const Header: React.FC<HeaderProps> = ({
  showLibrary,
  setShowLibrary,
  isLoading,
  handleFileUpload,
  isShuffled,
  toggleShuffle,
  normalizeAudio,
  toggleNormalize,
  playlists,
  currentPlaylistId,
  changePlaylist,
  createPlaylist,
  removePlaylist,
  handleExport,
  handleImportZip,
  defaultPlaylistId,
}) => {
  const [showPlaylistMenu, setShowPlaylistMenu] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  const handleCreatePlaylist = async () => {
    if (newPlaylistName.trim()) {
      await createPlaylist(newPlaylistName.trim());
      setNewPlaylistName('');
    }
  };

  return (
    <header className="p-4 flex flex-col gap-3 border-b border-gray-800">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-purple-400">echo</h1>
        <div className="flex gap-2 flex-wrap justify-end">
          {/* Settings toggle */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`px-3 py-2 rounded-md transition-colors ${
              showSettings ? 'bg-purple-600' : 'bg-gray-800 hover:bg-gray-700'
            }`}
            title="Settings"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
            </svg>
          </button>

          <button
            onClick={() => setShowLibrary(!showLibrary)}
            className="px-4 py-2 rounded-md bg-gray-800 hover:bg-gray-700 transition-colors"
          >
            {showLibrary ? "Hide Library" : "Show Library"}
          </button>
          <label className="px-4 py-2 rounded-md bg-purple-600 hover:bg-purple-700 transition-colors cursor-pointer">
            Upload
            <input
              type="file"
              accept="audio/mp3,audio/*"
              multiple
              onChange={handleFileUpload}
              className="hidden"
              disabled={isLoading}
            />
          </label>
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="flex flex-wrap gap-3 items-center p-3 bg-gray-800 rounded-lg">
          {/* Shuffle toggle */}
          <button
            onClick={toggleShuffle}
            className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
              isShuffled ? 'bg-purple-600 text-white' : 'bg-gray-700 hover:bg-gray-600'
            }`}
            title="Toggle shuffle"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Shuffle {isShuffled ? 'On' : 'Off'}
          </button>

          {/* Normalize toggle */}
          <button
            onClick={toggleNormalize}
            className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
              normalizeAudio ? 'bg-purple-600 text-white' : 'bg-gray-700 hover:bg-gray-600'
            }`}
            title="Toggle audio normalization"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
            </svg>
            Normalize {normalizeAudio ? 'On' : 'Off'}
          </button>

          {/* Export button */}
          <button
            onClick={handleExport}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-2 rounded-md bg-gray-700 hover:bg-gray-600 transition-colors disabled:opacity-50"
            title="Export all songs to ZIP"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            Export ZIP
          </button>

          {/* Import ZIP */}
          <label className="flex items-center gap-2 px-3 py-2 rounded-md bg-gray-700 hover:bg-gray-600 transition-colors cursor-pointer">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
            Import ZIP
            <input
              type="file"
              accept=".zip"
              onChange={handleImportZip}
              className="hidden"
              disabled={isLoading}
            />
          </label>
        </div>
      )}

      {/* Playlist selector */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-400">Playlist:</span>
        <div className="relative">
          <button
            onClick={() => setShowPlaylistMenu(!showPlaylistMenu)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-gray-800 hover:bg-gray-700 transition-colors"
          >
            <span>{playlists.find(p => p.id === currentPlaylistId)?.name || 'Select Playlist'}</span>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>

          {showPlaylistMenu && (
            <div className="absolute top-full left-0 mt-1 w-64 bg-gray-800 rounded-lg shadow-lg border border-gray-700 z-50">
              <div className="max-h-48 overflow-y-auto">
                {playlists.map(playlist => (
                  <div
                    key={playlist.id}
                    className={`flex items-center justify-between px-3 py-2 hover:bg-gray-700 cursor-pointer ${
                      playlist.id === currentPlaylistId ? 'bg-gray-700' : ''
                    }`}
                  >
                    <span
                      onClick={() => {
                        changePlaylist(playlist.id);
                        setShowPlaylistMenu(false);
                      }}
                      className="flex-1"
                    >
                      {playlist.name}
                    </span>
                    {playlist.id !== defaultPlaylistId && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removePlaylist(playlist.id);
                        }}
                        className="text-red-400 hover:text-red-300 p-1"
                        title="Delete playlist"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-700 p-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newPlaylistName}
                    onChange={(e) => setNewPlaylistName(e.target.value)}
                    placeholder="New playlist name"
                    className="flex-1 px-2 py-1 rounded bg-gray-700 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreatePlaylist();
                    }}
                  />
                  <button
                    onClick={handleCreatePlaylist}
                    disabled={!newPlaylistName.trim()}
                    className="px-2 py-1 rounded bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-sm"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};