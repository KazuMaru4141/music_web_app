'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Play, Pause, Save, Check, SkipBack, SkipForward } from 'lucide-react';

export default function NowPlaying() {
    const [track, setTrack] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [controlLoading, setControlLoading] = useState(false);
    const [rating, setRating] = useState(0);
    const [error, setError] = useState('');

    const fetchTrack = async () => {
        try {
            const res = await fetch('/api/player/now-playing');
            if (res.status === 401) {
                setError('Please login');
                return;
            }
            const data = await res.json();
            if (data.is_playing === false) {
                setTrack(null);
            } else {
                setTrack(data);
                setRating(data.rating || 0);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleRate = async (star: number) => {
        setRating(star);
        if (!track) return;

        // Optimistic UI update for album tracks and score
        const trackPoints: Record<number, number> = { 1: 0, 2: 10, 3: 60, 4: 80, 5: 100 };
        const updatedAlbumTracks = track.album_tracks?.map((t: any) =>
            t.id === track.id ? { ...t, rating: star } : t
        ) || [];

        let totalPoints = 0;
        updatedAlbumTracks.forEach((t: any) => {
            totalPoints += trackPoints[t.rating] || 0;
        });
        const newAlbumScore = updatedAlbumTracks.length > 0
            ? parseFloat((totalPoints / updatedAlbumTracks.length).toFixed(1))
            : 0;

        setTrack((prev: any) => prev ? {
            ...prev,
            album_tracks: updatedAlbumTracks,
            album_score: newAlbumScore
        } : prev);

        try {
            await fetch('/api/player/like', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ track, rating: star })
            });
        } catch (e) {
            console.error("Failed to rate", e);
        }
    };

    const handleControl = async (action: 'play' | 'pause' | 'next' | 'previous') => {
        if (controlLoading) return;
        setControlLoading(true);

        // Optimistic UI update for play/pause only
        if (action === 'play' || action === 'pause') {
            setTrack((prev: any) => prev ? { ...prev, is_playing: action === 'play' } : prev);
        }

        try {
            const res = await fetch('/api/player/control', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action })
            });

            if (!res.ok) {
                const data = await res.json();
                alert(`Playback Error: ${data.error}`);
                fetchTrack(); // Revert
                return;
            }

            // For next/previous, fetch immediately after a short delay for Spotify to update
            if (action === 'next' || action === 'previous') {
                setTimeout(fetchTrack, 300);
            } else {
                // For play/pause, longer delay as confirmation
                setTimeout(fetchTrack, 1000);
            }
        } catch (e) {
            console.error("Control failed", e);
            fetchTrack();
        } finally {
            setControlLoading(false);
        }
    };

    const handleSaveAlbum = async () => {
        if (!track) return;
        try {
            const res = await fetch('/api/player/save-album', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ track })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to save');
            }
            const data = await res.json();

            // Update UI immediately after successful save
            setTrack((prev: any) => prev ? { ...prev, is_album_saved: true } : prev);

            if (data.status === 'updated') {
                alert("Album already saved/updated!");
            } else {
                alert("Album Saved!");
            }
        } catch (e: any) {
            console.error("Failed to save album", e);
            alert(`Error: ${e.message}`);
        }
    };

    useEffect(() => {
        fetchTrack();
        const interval = setInterval(fetchTrack, 15000); // 15s polling
        return () => clearInterval(interval);
    }, []);

    if (error === 'Please login') {
        return (
            <div className="p-6 bg-gray-900 rounded-xl text-center">
                <p className="text-gray-400 mb-4">Please login to see player</p>
                <a href="/api/auth/login" className="px-6 py-2 bg-green-600 rounded-full text-white font-bold hover:bg-green-500">
                    Login with Spotify
                </a>
            </div>
        )
    }

    if (loading) {
        return (
            <div className="p-6 bg-gray-900 rounded-xl animate-pulse">
                <div className="h-4 bg-gray-700 w-1/4 mb-4 rounded"></div>
                <div className="h-64 bg-gray-800 rounded-lg mb-4"></div>
            </div>
        );
    }

    if (!track) {
        return (
            <div className="p-6 bg-gray-900 rounded-xl flex flex-col items-center justify-center min-h-[400px]">
                <h2 className="text-xl text-gray-500 font-medium">Not Playing</h2>
                <p className="text-gray-600">Start playing music on Spotify to see it here.</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 p-4 md:p-6 bg-gradient-to-br from-gray-900 via-gray-800 to-black rounded-2xl md:rounded-3xl border border-gray-700 shadow-2xl">
            {/* Album Art Section */}
            <div className="flex flex-col space-y-3 md:space-y-4">
                <div className="relative aspect-square rounded-xl md:rounded-2xl overflow-hidden shadow-lg border border-gray-700/50 w-[280px] md:w-full mx-auto md:mx-0 group">
                    <Image
                        src={track.image}
                        alt={track.album}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                </div>

                {/* Playback Controls (Moved here) */}
                <div className="flex items-center justify-center space-x-8 md:space-x-6 bg-gray-800/40 py-2 md:py-3 rounded-xl md:rounded-2xl border border-gray-700/50 backdrop-blur-sm w-[280px] md:w-full mx-auto md:mx-0">
                    <button onClick={() => handleControl('previous')} className="text-gray-400 hover:text-white transition transform active:scale-90">
                        <SkipBack size={20} fill="currentColor" className="md:w-6 md:h-6" />
                    </button>
                    <button
                        onClick={() => handleControl(track.is_playing ? 'pause' : 'play')}
                        className="w-11 h-11 md:w-12 md:h-12 flex items-center justify-center bg-pink-500 hover:bg-pink-400 text-white rounded-full transition shadow-lg shadow-pink-500/30 transform hover:scale-105 active:scale-95"
                    >
                        {track.is_playing ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}
                    </button>
                    <button onClick={() => handleControl('next')} className="text-gray-400 hover:text-white transition transform active:scale-90">
                        <SkipForward size={20} fill="currentColor" className="md:w-6 md:h-6" />
                    </button>
                </div>
            </div>

            {/* Info Section */}
            <div className="flex flex-col justify-center space-y-3 md:space-y-4">
                <div className="text-center md:text-left">
                    <h2 className="text-xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400 line-clamp-2">
                        {track.name}
                    </h2>
                    <p className="text-base md:text-xl text-gray-300 font-medium mt-1 line-clamp-1">{track.artist}</p>
                    <p className="text-xs md:text-sm text-gray-500 line-clamp-1">{track.album}</p>
                </div>

                {/* Status Badges */}
                <div className="flex flex-wrap justify-center md:justify-start gap-2">
                    <span className="px-2 md:px-3 py-1 bg-green-900/50 text-green-400 text-[10px] md:text-xs rounded-full border border-green-800 backdrop-blur-sm">
                        Now Playing
                    </span>
                    <span className="px-2 md:px-3 py-1 bg-blue-900/50 text-blue-400 text-[10px] md:text-xs rounded-full border border-blue-800 backdrop-blur-sm">
                        {track.genre || 'Pop'}
                    </span>
                    {track.album_score !== undefined && (
                        <span className="px-2 md:px-3 py-1 bg-yellow-900/40 text-yellow-400 text-[10px] md:text-xs rounded-full border border-yellow-800 backdrop-blur-sm font-bold">
                            Score: {track.album_score}
                        </span>
                    )}
                </div>

                {/* Rating */}
                <div className="flex items-center justify-center md:justify-start space-x-2 py-1 md:py-2">
                    <div className="flex items-center space-x-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                            <button
                                key={star}
                                onClick={() => handleRate(star)}
                                className={`text-xl md:text-2xl transition-colors ${rating >= star ? 'text-yellow-400' : 'text-gray-700 hover:text-gray-500'}`}
                            >
                                ★
                            </button>
                        ))}
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-1 md:gap-2 text-center text-[10px] md:text-xs text-gray-400 bg-black/20 p-2 md:p-3 rounded-lg">
                    <div>
                        <p className="font-bold text-white text-sm md:text-base">{track.stats?.artist || 0}</p>
                        <p>Artist</p>
                    </div>
                    <div>
                        <p className="font-bold text-white text-sm md:text-base">{track.stats?.album || 0}</p>
                        <p>Album</p>
                    </div>
                    <div>
                        <p className="font-bold text-white text-sm md:text-base">{track.stats?.track || 0}</p>
                        <p>Track</p>
                    </div>
                </div>
                {/* Action Buttons */}
                <div className="flex space-x-2 md:space-x-3 mt-2 md:mt-4">
                    <button
                        onClick={handleSaveAlbum}
                        disabled={track.is_album_saved}
                        className={`flex-1 flex items-center justify-center space-x-1 md:space-x-2 py-2 md:py-3 rounded-lg md:rounded-xl transition font-medium text-sm md:text-base ${track.is_album_saved ? 'bg-cyan-900/30 text-cyan-400 border border-cyan-800 cursor-default' : 'bg-gray-700 hover:bg-gray-600 text-white'}`}
                    >
                        {track.is_album_saved ? <Check size={16} /> : <Save size={16} />}
                        <span>{track.is_album_saved ? 'Saved' : 'Save'}</span>
                    </button>
                    {/* Replaced Like Button with Last.fm Stats */}
                    <div className="flex-1 flex flex-col items-center justify-center bg-gray-800/50 rounded-lg md:rounded-xl p-1.5 md:p-2 border border-gray-700">
                        <div className="text-[10px] md:text-xs text-gray-400">Total / Today</div>
                        <div className="text-base md:text-lg font-bold text-pink-500">
                            {track.stats?.total || 0} / {track.stats?.today || 0}
                        </div>
                    </div>
                </div>

                {/* Album Tracks Section */}
                {track.album_tracks && track.album_tracks.length > 0 && (
                    <div className="mt-4 md:mt-8 pt-4 md:pt-6 border-t border-gray-700/50">
                        <h4 className="text-xs md:text-sm font-semibold text-gray-400 mb-2 md:mb-4 uppercase tracking-wider">Album Tracks</h4>
                        <div className="space-y-1 md:space-y-2 max-h-40 md:max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                            {track.album_tracks.map((t: any, index: number) => (
                                <div key={t.id} className={`flex items-center justify-between p-2 rounded-lg transition ${t.id === track.id ? 'bg-pink-500/10 border border-pink-500/20' : 'hover:bg-gray-800/50'}`}>
                                    <div className="flex items-center space-x-3 truncate mr-4">
                                        <span className="text-xs text-gray-500 font-mono w-4">{index + 1}</span>
                                        <span className={`text-sm truncate ${t.id === track.id ? 'text-pink-400 font-medium' : 'text-gray-300'}`}>
                                            {t.name}
                                        </span>
                                    </div>
                                    <div className="flex items-center space-x-1 shrink-0">
                                        {[1, 2, 3, 4, 5].map((star) => (
                                            <span
                                                key={star}
                                                className={`text-[10px] ${t.rating >= star ? 'text-yellow-400' : 'text-gray-600'}`}
                                            >
                                                ★
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
