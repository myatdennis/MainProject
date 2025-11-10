import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, SkipForward, SkipBack, Settings, Subtitles, RotateCcw } from 'lucide-react';
const EnhancedVideoPlayer = ({ src, title, thumbnail, onProgress, onComplete, initialTime = 0, className = '', autoPlay = false, showTranscript = false, transcript = '', captions = [] }) => {
    const videoRef = useRef(null);
    const containerRef = useRef(null);
    const progressBarRef = useRef(null);
    // Player state
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [showSettings, setShowSettings] = useState(false);
    const [showCaptions, setShowCaptions] = useState(false);
    // const [quality, setQuality] = useState('auto'); // TODO: Implement quality selector
    // Advanced features
    const [isDragging] = useState(false); // TODO: Implement drag functionality
    const [hasStarted, setHasStarted] = useState(false);
    const [watchTime] = useState(0); // TODO: Implement watch time tracking
    const [buffered, setBuffered] = useState(0);
    const [currentCaption, setCurrentCaption] = useState('');
    // Hide controls timer
    const controlsTimeoutRef = useRef();
    // Initialize video
    useEffect(() => {
        const video = videoRef.current;
        if (!video)
            return;
        const handleLoadStart = () => setIsLoading(true);
        const handleCanPlay = () => {
            setIsLoading(false);
            if (initialTime > 0) {
                video.currentTime = initialTime;
            }
        };
        const handleLoadedMetadata = () => {
            setDuration(video.duration);
        };
        const handleTimeUpdate = () => {
            const time = video.currentTime;
            setCurrentTime(time);
            if (!isDragging && onProgress) {
                onProgress((time / video.duration) * 100);
            }
            // Update captions
            if (captions.length > 0 && showCaptions) {
                const caption = captions.find(c => time >= c.start && time <= c.end);
                setCurrentCaption(caption ? caption.text : '');
            }
            // Auto-save progress every 10 seconds
            if (Math.floor(time) % 10 === 0) {
                localStorage.setItem(`video-progress-${src}`, time.toString());
            }
        };
        const handleProgress = () => {
            if (video.buffered.length > 0) {
                const bufferedEnd = video.buffered.end(video.buffered.length - 1);
                setBuffered((bufferedEnd / video.duration) * 100);
            }
        };
        const handleEnded = () => {
            setIsPlaying(false);
            setCurrentTime(duration);
            if (onComplete)
                onComplete();
            // Clear saved progress
            localStorage.removeItem(`video-progress-${src}`);
        };
        const handlePlay = () => {
            setIsPlaying(true);
            setHasStarted(true);
        };
        const handlePause = () => setIsPlaying(false);
        video.addEventListener('loadstart', handleLoadStart);
        video.addEventListener('canplay', handleCanPlay);
        video.addEventListener('loadedmetadata', handleLoadedMetadata);
        video.addEventListener('timeupdate', handleTimeUpdate);
        video.addEventListener('progress', handleProgress);
        video.addEventListener('ended', handleEnded);
        video.addEventListener('play', handlePlay);
        video.addEventListener('pause', handlePause);
        return () => {
            video.removeEventListener('loadstart', handleLoadStart);
            video.removeEventListener('canplay', handleCanPlay);
            video.removeEventListener('loadedmetadata', handleLoadedMetadata);
            video.removeEventListener('timeupdate', handleTimeUpdate);
            video.removeEventListener('progress', handleProgress);
            video.removeEventListener('ended', handleEnded);
            video.removeEventListener('play', handlePlay);
            video.removeEventListener('pause', handlePause);
        };
    }, [src, initialTime, onProgress, onComplete, isDragging, duration, captions, showCaptions]);
    // Load saved progress
    useEffect(() => {
        const savedProgress = localStorage.getItem(`video-progress-${src}`);
        if (savedProgress && videoRef.current) {
            const savedTime = parseFloat(savedProgress);
            videoRef.current.currentTime = savedTime;
            setCurrentTime(savedTime);
        }
    }, [src]);
    // Watch time tracking
    useEffect(() => {
        let interval;
        if (isPlaying && !isDragging) {
            interval = setInterval(() => {
                // TODO: Implement watch time tracking
                console.log(`Watch time: ${watchTime + 1}s`);
            }, 1000);
        }
        return () => {
            if (interval)
                clearInterval(interval);
        };
    }, [isPlaying, isDragging]);
    // Auto-hide controls
    const resetControlsTimeout = useCallback(() => {
        if (controlsTimeoutRef.current) {
            clearTimeout(controlsTimeoutRef.current);
        }
        setShowControls(true);
        if (isPlaying) {
            controlsTimeoutRef.current = setTimeout(() => {
                setShowControls(false);
            }, 3000);
        }
    }, [isPlaying]);
    // Player controls
    const togglePlay = () => {
        const video = videoRef.current;
        if (!video)
            return;
        if (isPlaying) {
            video.pause();
        }
        else {
            video.play();
        }
    };
    const handleSeek = (percentage) => {
        const video = videoRef.current;
        if (!video || !duration)
            return;
        const time = (percentage / 100) * duration;
        video.currentTime = time;
        setCurrentTime(time);
    };
    const skip = (seconds) => {
        const video = videoRef.current;
        if (!video)
            return;
        video.currentTime = Math.max(0, Math.min(duration, currentTime + seconds));
    };
    const handleVolumeChange = (newVolume) => {
        const video = videoRef.current;
        if (!video)
            return;
        video.volume = newVolume;
        setVolume(newVolume);
        setIsMuted(newVolume === 0);
    };
    const toggleMute = () => {
        const video = videoRef.current;
        if (!video)
            return;
        if (isMuted) {
            video.volume = volume || 0.5;
            setIsMuted(false);
        }
        else {
            video.volume = 0;
            setIsMuted(true);
        }
    };
    const changePlaybackSpeed = (speed) => {
        const video = videoRef.current;
        if (!video)
            return;
        video.playbackRate = speed;
        setPlaybackSpeed(speed);
        setShowSettings(false);
    };
    const toggleFullscreen = async () => {
        const container = containerRef.current;
        if (!container)
            return;
        if (!isFullscreen) {
            if (container.requestFullscreen) {
                await container.requestFullscreen();
            }
        }
        else {
            if (document.exitFullscreen) {
                await document.exitFullscreen();
            }
        }
    };
    // Handle fullscreen change
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);
    // Progress bar interaction
    const handleProgressClick = (e) => {
        const progressBar = progressBarRef.current;
        if (!progressBar || !duration)
            return;
        const rect = progressBar.getBoundingClientRect();
        const percentage = ((e.clientX - rect.left) / rect.width) * 100;
        handleSeek(Math.max(0, Math.min(100, percentage)));
    };
    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyPress = (e) => {
            if (!hasStarted)
                return;
            switch (e.key) {
                case ' ':
                    e.preventDefault();
                    togglePlay();
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    skip(-10);
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    skip(10);
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    handleVolumeChange(Math.min(1, volume + 0.1));
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    handleVolumeChange(Math.max(0, volume - 0.1));
                    break;
                case 'm':
                    e.preventDefault();
                    toggleMute();
                    break;
                case 'f':
                    e.preventDefault();
                    toggleFullscreen();
                    break;
                case 'c':
                    e.preventDefault();
                    setShowCaptions(!showCaptions);
                    break;
            }
        };
        document.addEventListener('keydown', handleKeyPress);
        return () => document.removeEventListener('keydown', handleKeyPress);
    }, [hasStarted, volume, showCaptions]);
    // Format time
    const formatTime = (seconds) => {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    };
    return (_jsxs("div", { ref: containerRef, className: `relative bg-black rounded-lg overflow-hidden ${className}`, onMouseMove: resetControlsTimeout, onMouseLeave: () => isPlaying && setShowControls(false), children: [_jsx("video", { ref: videoRef, src: src, poster: thumbnail, className: "w-full h-full", autoPlay: autoPlay, playsInline: true, preload: "metadata", onClick: togglePlay }), isLoading && (_jsx("div", { className: "absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center", children: _jsx("div", { className: "animate-spin rounded-full h-12 w-12 border-b-2 border-white" }) })), !isPlaying && !isLoading && (_jsx("div", { className: "absolute inset-0 flex items-center justify-center", children: _jsx("button", { onClick: togglePlay, className: "bg-orange-500 bg-opacity-90 hover:bg-opacity-100 rounded-full p-6 transition-all duration-200 transform hover:scale-105", children: _jsx(Play, { className: "h-8 w-8 text-white ml-1", fill: "white" }) }) })), showCaptions && currentCaption && (_jsx("div", { className: "absolute bottom-20 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-75 text-white px-4 py-2 rounded max-w-md text-center", children: currentCaption })), _jsxs("div", { className: `absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black to-transparent p-4 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`, children: [_jsx("div", { className: "mb-4", children: _jsxs("div", { ref: progressBarRef, className: "w-full h-2 bg-gray-600 rounded-full cursor-pointer relative overflow-hidden", onClick: handleProgressClick, children: [_jsx("div", { className: "absolute top-0 left-0 h-full bg-gray-400 rounded-full", style: { width: `${buffered}%` } }), _jsx("div", { className: "absolute top-0 left-0 h-full bg-orange-500 rounded-full transition-all duration-100", style: { width: `${(currentTime / duration) * 100}%` } }), _jsx("div", { className: "absolute top-1/2 transform -translate-y-1/2 w-4 h-4 bg-orange-500 rounded-full border-2 border-white shadow-lg transition-all duration-100", style: { left: `${(currentTime / duration) * 100}%`, marginLeft: '-8px' } })] }) }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center space-x-4", children: [_jsx("button", { onClick: togglePlay, className: "text-white hover:text-orange-400 transition-colors duration-200", children: isPlaying ? (_jsx(Pause, { className: "h-6 w-6" })) : (_jsx(Play, { className: "h-6 w-6" })) }), _jsx("button", { onClick: () => skip(-10), className: "text-white hover:text-orange-400 transition-colors duration-200", children: _jsx(SkipBack, { className: "h-5 w-5" }) }), _jsx("button", { onClick: () => skip(10), className: "text-white hover:text-orange-400 transition-colors duration-200", children: _jsx(SkipForward, { className: "h-5 w-5" }) }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("button", { onClick: toggleMute, className: "text-white hover:text-orange-400 transition-colors duration-200", children: isMuted || volume === 0 ? (_jsx(VolumeX, { className: "h-5 w-5" })) : (_jsx(Volume2, { className: "h-5 w-5" })) }), _jsx("input", { type: "range", min: "0", max: "1", step: "0.1", value: isMuted ? 0 : volume, onChange: (e) => handleVolumeChange(parseFloat(e.target.value)), className: "w-20 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer slider" })] }), _jsxs("div", { className: "text-white text-sm font-medium", children: [formatTime(currentTime), " / ", formatTime(duration)] })] }), _jsxs("div", { className: "flex items-center space-x-4", children: [captions.length > 0 && (_jsx("button", { onClick: () => setShowCaptions(!showCaptions), className: `transition-colors duration-200 ${showCaptions ? 'text-orange-400' : 'text-white hover:text-orange-400'}`, children: _jsx(Subtitles, { className: "h-5 w-5" }) })), _jsxs("div", { className: "relative", children: [_jsx("button", { onClick: () => setShowSettings(!showSettings), className: "text-white hover:text-orange-400 transition-colors duration-200", children: _jsx(Settings, { className: "h-5 w-5" }) }), showSettings && (_jsxs("div", { className: "absolute bottom-8 right-0 bg-black bg-opacity-90 rounded-lg p-3 min-w-[120px]", children: [_jsx("div", { className: "text-white text-sm font-medium mb-2", children: "Playback Speed" }), [0.5, 0.75, 1, 1.25, 1.5, 2].map(speed => (_jsxs("button", { onClick: () => changePlaybackSpeed(speed), className: `block w-full text-left px-2 py-1 text-sm rounded transition-colors ${playbackSpeed === speed
                                                            ? 'bg-orange-500 text-white'
                                                            : 'text-gray-300 hover:bg-gray-700'}`, children: [speed, "x"] }, speed)))] }))] }), _jsx("button", { onClick: toggleFullscreen, className: "text-white hover:text-orange-400 transition-colors duration-200", children: isFullscreen ? (_jsx(Minimize, { className: "h-5 w-5" })) : (_jsx(Maximize, { className: "h-5 w-5" })) })] })] })] }), title && showControls && (_jsx("div", { className: "absolute top-4 left-4 text-white font-medium text-lg bg-black bg-opacity-50 px-3 py-1 rounded", children: title })), currentTime >= duration - 1 && duration > 0 && (_jsx("div", { className: "absolute top-4 right-4", children: _jsxs("button", { onClick: () => handleSeek(0), className: "bg-orange-500 bg-opacity-90 hover:bg-opacity-100 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-all duration-200", children: [_jsx(RotateCcw, { className: "h-4 w-4" }), _jsx("span", { children: "Restart" })] }) })), showTranscript && transcript && (_jsxs("div", { className: "absolute right-0 top-0 bottom-0 w-80 bg-white bg-opacity-95 overflow-y-auto p-4 text-sm", children: [_jsx("h3", { className: "font-semibold mb-4 text-gray-900", children: "Transcript" }), _jsx("div", { className: "text-gray-700 leading-relaxed whitespace-pre-wrap", children: transcript })] }))] }));
};
export default EnhancedVideoPlayer;
