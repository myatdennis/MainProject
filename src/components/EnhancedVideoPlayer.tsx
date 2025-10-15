import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Minimize,
  SkipForward, 
  SkipBack,
  Settings,
  Subtitles,
  RotateCcw
} from 'lucide-react';

interface EnhancedVideoPlayerProps {
  src: string;
  title?: string;
  thumbnail?: string;
  onProgress?: (progress: number) => void;
  onComplete?: () => void;
  initialTime?: number;
  className?: string;
  autoPlay?: boolean;
  showTranscript?: boolean;
  transcript?: string;
  captions?: Array<{
    start: number;
    end: number;
    text: string;
  }>;
}

const EnhancedVideoPlayer: React.FC<EnhancedVideoPlayerProps> = ({
  src,
  title,
  thumbnail,
  onProgress,
  onComplete,
  initialTime = 0,
  className = '',
  autoPlay = false,
  showTranscript = false,
  transcript = '',
  captions = []
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  
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
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();

  // Initialize video
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

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
      if (onComplete) onComplete();
      
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
    let interval: NodeJS.Timeout;
    if (isPlaying && !isDragging) {
      interval = setInterval(() => {
        // TODO: Implement watch time tracking
        console.log(`Watch time: ${watchTime + 1}s`);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
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
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
  };

  const handleSeek = (percentage: number) => {
    const video = videoRef.current;
    if (!video || !duration) return;

    const time = (percentage / 100) * duration;
    video.currentTime = time;
    setCurrentTime(time);
  };

  const skip = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;

    video.currentTime = Math.max(0, Math.min(duration, currentTime + seconds));
  };

  const handleVolumeChange = (newVolume: number) => {
    const video = videoRef.current;
    if (!video) return;

    video.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isMuted) {
      video.volume = volume || 0.5;
      setIsMuted(false);
    } else {
      video.volume = 0;
      setIsMuted(true);
    }
  };

  const changePlaybackSpeed = (speed: number) => {
    const video = videoRef.current;
    if (!video) return;

    video.playbackRate = speed;
    setPlaybackSpeed(speed);
    setShowSettings(false);
  };

  const toggleFullscreen = async () => {
    const container = containerRef.current;
    if (!container) return;

    if (!isFullscreen) {
      if (container.requestFullscreen) {
        await container.requestFullscreen();
      }
    } else {
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
  const handleProgressClick = (e: React.MouseEvent) => {
    const progressBar = progressBarRef.current;
    if (!progressBar || !duration) return;

    const rect = progressBar.getBoundingClientRect();
    const percentage = ((e.clientX - rect.left) / rect.width) * 100;
    handleSeek(Math.max(0, Math.min(100, percentage)));
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!hasStarted) return;

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
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div 
      ref={containerRef}
      className={`relative bg-black rounded-lg overflow-hidden ${className}`}
      onMouseMove={resetControlsTimeout}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        src={src}
        poster={thumbnail}
        className="w-full h-full"
        autoPlay={autoPlay}
        playsInline
        preload="metadata"
        onClick={togglePlay}
      />

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
        </div>
      )}

      {/* Play Button Overlay (when paused) */}
      {!isPlaying && !isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <button
            onClick={togglePlay}
            className="bg-orange-500 bg-opacity-90 hover:bg-opacity-100 rounded-full p-6 transition-all duration-200 transform hover:scale-105"
          >
            <Play className="h-8 w-8 text-white ml-1" fill="white" />
          </button>
        </div>
      )}

      {/* Captions */}
      {showCaptions && currentCaption && (
        <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-75 text-white px-4 py-2 rounded max-w-md text-center">
          {currentCaption}
        </div>
      )}

      {/* Controls */}
      <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black to-transparent p-4 transition-opacity duration-300 ${
        showControls ? 'opacity-100' : 'opacity-0'
      }`}>
        {/* Progress Bar */}
        <div className="mb-4">
          <div 
            ref={progressBarRef}
            className="w-full h-2 bg-gray-600 rounded-full cursor-pointer relative overflow-hidden"
            onClick={handleProgressClick}
          >
            {/* Buffered Progress */}
            <div 
              className="absolute top-0 left-0 h-full bg-gray-400 rounded-full"
              style={{ width: `${buffered}%` }}
            />
            
            {/* Current Progress */}
            <div 
              className="absolute top-0 left-0 h-full bg-orange-500 rounded-full transition-all duration-100"
              style={{ width: `${(currentTime / duration) * 100}%` }}
            />
            
            {/* Progress Thumb */}
            <div 
              className="absolute top-1/2 transform -translate-y-1/2 w-4 h-4 bg-orange-500 rounded-full border-2 border-white shadow-lg transition-all duration-100"
              style={{ left: `${(currentTime / duration) * 100}%`, marginLeft: '-8px' }}
            />
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={togglePlay}
              className="text-white hover:text-orange-400 transition-colors duration-200"
            >
              {isPlaying ? (
                <Pause className="h-6 w-6" />
              ) : (
                <Play className="h-6 w-6" />
              )}
            </button>

            <button
              onClick={() => skip(-10)}
              className="text-white hover:text-orange-400 transition-colors duration-200"
            >
              <SkipBack className="h-5 w-5" />
            </button>

            <button
              onClick={() => skip(10)}
              className="text-white hover:text-orange-400 transition-colors duration-200"
            >
              <SkipForward className="h-5 w-5" />
            </button>

            {/* Volume Control */}
            <div className="flex items-center space-x-2">
              <button
                onClick={toggleMute}
                className="text-white hover:text-orange-400 transition-colors duration-200"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="h-5 w-5" />
                ) : (
                  <Volume2 className="h-5 w-5" />
                )}
              </button>
              
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={isMuted ? 0 : volume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                className="w-20 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
              />
            </div>

            {/* Time Display */}
            <div className="text-white text-sm font-medium">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Captions Toggle */}
            {captions.length > 0 && (
              <button
                onClick={() => setShowCaptions(!showCaptions)}
                className={`transition-colors duration-200 ${
                  showCaptions ? 'text-orange-400' : 'text-white hover:text-orange-400'
                }`}
              >
                <Subtitles className="h-5 w-5" />
              </button>
            )}

            {/* Settings */}
            <div className="relative">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="text-white hover:text-orange-400 transition-colors duration-200"
              >
                <Settings className="h-5 w-5" />
              </button>

              {showSettings && (
                <div className="absolute bottom-8 right-0 bg-black bg-opacity-90 rounded-lg p-3 min-w-[120px]">
                  <div className="text-white text-sm font-medium mb-2">Playback Speed</div>
                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map(speed => (
                    <button
                      key={speed}
                      onClick={() => changePlaybackSpeed(speed)}
                      className={`block w-full text-left px-2 py-1 text-sm rounded transition-colors ${
                        playbackSpeed === speed 
                          ? 'bg-orange-500 text-white' 
                          : 'text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="text-white hover:text-orange-400 transition-colors duration-200"
            >
              {isFullscreen ? (
                <Minimize className="h-5 w-5" />
              ) : (
                <Maximize className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Title Overlay */}
      {title && showControls && (
        <div className="absolute top-4 left-4 text-white font-medium text-lg bg-black bg-opacity-50 px-3 py-1 rounded">
          {title}
        </div>
      )}

      {/* Restart Button (when ended) */}
      {currentTime >= duration - 1 && duration > 0 && (
        <div className="absolute top-4 right-4">
          <button
            onClick={() => handleSeek(0)}
            className="bg-orange-500 bg-opacity-90 hover:bg-opacity-100 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-all duration-200"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Restart</span>
          </button>
        </div>
      )}

      {/* Transcript Panel */}
      {showTranscript && transcript && (
        <div className="absolute right-0 top-0 bottom-0 w-80 bg-white bg-opacity-95 overflow-y-auto p-4 text-sm">
          <h3 className="font-semibold mb-4 text-gray-900">Transcript</h3>
          <div className="text-gray-700 leading-relaxed whitespace-pre-wrap">
            {transcript}
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedVideoPlayer;