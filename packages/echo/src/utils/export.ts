// src/utils/export.ts
import JSZip from 'jszip';
import type { Song, Playlist } from '../types';

export const exportToZip = async (
  songs: Song[],
  playlists: Playlist[]
): Promise<void> => {
  const zip = new JSZip();

  // Create a metadata file
  const metadata = {
    exportedAt: new Date().toISOString(),
    playlists: playlists.map(p => ({
      id: p.id,
      name: p.name,
      createdAt: p.createdAt,
    })),
    songs: songs.map(s => ({
      id: s.id,
      title: s.title,
      artist: s.artist,
      duration: s.duration,
      playlistId: s.playlistId,
    })),
  };

  zip.file('echo-metadata.json', JSON.stringify(metadata, null, 2));

  // Add each song file
  for (const song of songs) {
    if (song.file instanceof Blob) {
      // Get file extension from the blob type or default to mp3
      const ext = song.file.type.includes('mpeg') ? 'mp3' :
                  song.file.type.includes('wav') ? 'wav' :
                  song.file.type.includes('ogg') ? 'ogg' :
                  song.file.type.includes('m4a') ? 'm4a' : 'mp3';
      const fileName = `${song.title}.${ext}`;
      zip.file(fileName, song.file);
    } else if (song.file instanceof ArrayBuffer) {
      const fileName = `${song.title}.mp3`;
      zip.file(fileName, song.file);
    }
  }

  // Generate and download the zip
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `echo-export-${new Date().toISOString().split('T')[0]}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const importFromZip = async (
  file: File
): Promise<{ songs: Array<{ title: string; file: Blob; playlistId?: string }>; playlists: Playlist[] }> => {
  const zip = await JSZip.loadAsync(file);

  // Read metadata if it exists
  let metadata: {
    playlists?: Array<{ id: string; name: string; createdAt: number }>;
    songs?: Array<{ id: string; title: string; playlistId?: string }>;
  } = {};

  const metadataFile = zip.file('echo-metadata.json');
  if (metadataFile) {
    const metadataContent = await metadataFile.async('string');
    metadata = JSON.parse(metadataContent);
  }

  // Extract playlists
  const playlists: Playlist[] = (metadata.playlists || []).map(p => ({
    id: p.id,
    name: p.name,
    createdAt: p.createdAt,
  }));

  // Extract songs
  const songs: Array<{ title: string; file: Blob; playlistId?: string }> = [];
  const songMetadataMap = new Map(
    (metadata.songs || []).map(s => [s.title, s])
  );

  for (const [fileName, fileData] of Object.entries(zip.files)) {
    if (fileName === 'echo-metadata.json' || fileData.dir) continue;

    const blob = await fileData.async('blob');
    const title = fileName.replace(/\.[^/.]+$/, ''); // Remove extension
    const songMeta = songMetadataMap.get(title);

    songs.push({
      title,
      file: blob,
      playlistId: songMeta?.playlistId,
    });
  }

  return { songs, playlists };
};
