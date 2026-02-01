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

        // Optimistic UI update
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

            // Force immediate refresh with delay for feedback
            setTimeout(fetchTrack, 1000);
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6 bg-gradient-to-br from-gray-900 via-gray-800 to-black rounded-3xl border border-gray-700 shadow-2xl">
            {/* Album Art Section */}
            <div className="flex flex-col space-y-4">
                <div className="relative group aspect-square rounded-2xl overflow-hidden shadow-lg border border-gray-700/50">
                    <Image
                        src={track.image}
                        alt={track.album}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                </div>

                {/* Playback Controls (Moved here) */}
                <div className="flex items-center justify-center space-x-6 bg-gray-800/40 py-3 rounded-2xl border border-gray-700/50 backdrop-blur-sm">
                    <button onClick={() => handleControl('previous')} className="text-gray-400 hover:text-white transition transform active:scale-90">
                        <SkipBack size={24} fill="currentColor" />
                    </button>
                    <button
                        onClick={() => handleControl(track.is_playing ? 'pause' : 'play')}
                        className="w-12 h-12 flex items-center justify-center bg-pink-500 hover:bg-pink-400 text-white rounded-full transition shadow-lg shadow-pink-500/30 transform hover:scale-105 active:scale-95"
                    >
                        {track.is_playing ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
                    </button>
                    <button onClick={() => handleControl('next')} className="text-gray-400 hover:text-white transition transform active:scale-90">
                        <SkipForward size={24} fill="currentColor" />
                    </button>
                </div>
            </div>

            {/* Info Section */}
            <div className="flex flex-col justify-center space-y-4">
                <div>
                    <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                        {track.name}
                    </h2>
                    <p className="text-xl text-gray-300 font-medium mt-1">{track.artist}</p>
                    <p className="text-sm text-gray-500">{track.album}</p>
                </div>

                {/* Status Badges */}
                <div className="flex space-x-3">
                    <span className="px-3 py-1 bg-green-900/50 text-green-400 text-xs rounded-full border border-green-800 backdrop-blur-sm">
                        Now Playing
                    </span>
                    <span className="px-3 py-1 bg-blue-900/50 text-blue-400 text-xs rounded-full border border-blue-800 backdrop-blur-sm">
                        {track.genre || 'Pop'}
                    </span>
                    {track.album_score !== undefined && (
                        <span className="px-3 py-1 bg-yellow-900/40 text-yellow-400 text-xs rounded-full border border-yellow-800 backdrop-blur-sm font-bold">
                            Score: {track.album_score}
                        </span>
                    )}
                </div>

                {/* Rating */}
                <div className="flex items-center space-x-2 py-2">
                    <div className="flex items-center space-x-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                            <button
                                key={star}
                                onClick={() => handleRate(star)}
                                className={`text-2xl transition-colors ${rating >= star ? 'text-yellow-400' : 'text-gray-700 hover:text-gray-500'}`}
                            >
                                ★
                            </button>
                        ))}
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-2 text-center text-xs text-gray-400 bg-black/20 p-3 rounded-lg">
                    <div>
                        <p className="font-bold text-white">{track.stats?.artist || 0}</p>
                        <p>Artist Plays</p>
                    </div>
                    <div>
                        <p className="font-bold text-white">{track.stats?.album || 0}</p>
                        <p>Album Plays</p>
                    </div>
                    <div>
                        <p className="font-bold text-white">{track.stats?.track || 0}</p>
                        <p>Track Plays</p>
                    </div>
                </div>
                {/* Action Buttons */}
                <div className="flex space-x-3 mt-4">
                    <button
                        onClick={handleSaveAlbum}
                        disabled={track.is_album_saved}
                        className={`flex-1 flex items-center justify-center space-x-2 py-3 rounded-xl transition font-medium ${track.is_album_saved ? 'bg-cyan-900/30 text-cyan-400 border border-cyan-800 cursor-default' : 'bg-gray-700 hover:bg-gray-600 text-white'}`}
                    >
                        {track.is_album_saved ? <Check size={18} /> : <Save size={18} />}
                        <span>{track.is_album_saved ? 'Saved' : 'Save Album'}</span>
                    </button>
                    {/* Replaced Like Button with Last.fm Stats */}
                    <div className="flex-1 flex flex-col items-center justify-center bg-gray-800/50 rounded-xl p-2 border border-gray-700">
                        <div className="text-xs text-gray-400">Total / Today</div>
                        <div className="text-lg font-bold text-pink-500">
                            {track.stats?.total || 0} / {track.stats?.today || 0}
                        </div>
                    </div>
                </div>

                {/* Album Tracks Section */}
                {track.album_tracks && track.album_tracks.length > 0 && (
                    <div className="mt-8 pt-6 border-t border-gray-700/50">
                        <h4 className="text-sm font-semibold text-gray-400 mb-4 uppercase tracking-wider">Album Tracks</h4>
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
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
