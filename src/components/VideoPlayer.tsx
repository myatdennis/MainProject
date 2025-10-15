import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, SkipBack, SkipForward, Settings } from 'lucide-react';

interface VideoPlayerProps {
  videoContent: {
    id: string;
    type: 'upload' | 'url';
    title: string;
    description?: string;
    url?: string;
    file?: File;
    thumbnail?: string;
    duration?: number;
    transcriptFile?: File;
    captionsFile?: File;
    watchPercentage?: number;
    resumeFromLastPosition?: boolean;
    markAsWatched?: boolean;
    settings: {
      requireWatchPercentage: number;
      resumeFromLastPosition: boolean;
      markAsWatched: boolean;
    };
  };
  onProgress?: (progress: number) => void;
  onComplete?: () => void;
  resumeTime?: number;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoContent,
  onProgress,
  onComplete,
  resumeTime = 0
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(resumeTime);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [watchedPercentage, setWatchedPercentage] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);

  // Storage key for resume position
  const resumeStorageKey = `video_resume_${videoContent.id}`;

  // Load resume time from localStorage if enabled
  const getResumeTime = () => {
    if (!videoContent.settings.resumeFromLastPosition) return 0;
    
    try {
      const saved = localStorage.getItem(resumeStorageKey);
      if (saved) {
        const { time, percentage } = JSON.parse(saved);
        // Only resume if less than 90% watched (don't resume at end)
        return percentage < 90 ? time : 0;
      }
    } catch (error) {
      console.warn('Failed to load resume time:', error);
    }
    return resumeTime;
  };

  // Save current position for resume
  const saveResumePosition = (time: number, percentage: number) => {
    if (!videoContent.settings.resumeFromLastPosition) return;
    
    try {
      localStorage.setItem(resumeStorageKey, JSON.stringify({
        time,
        percentage,
        timestamp: Date.now(),
        videoId: videoContent.id
      }));
    } catch (error) {
      console.warn('Failed to save resume position:', error);
    }
  };

  // Get video source URL
  const getVideoSource = () => {
    if (videoContent.type === 'upload' && videoContent.file) {
      return URL.createObjectURL(videoContent.file);
    }
    return videoContent.url || '';
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      // Load resume time from localStorage or props
      const savedResumeTime = getResumeTime();
      if (savedResumeTime > 0) {
        video.currentTime = savedResumeTime;
        setCurrentTime(savedResumeTime);
        setProgress((savedResumeTime / video.duration) * 100);
      }
    };

    const handleTimeUpdate = () => {
      const current = video.currentTime;
      const total = video.duration;
      
      setCurrentTime(current);
      const currentProgress = (current / total) * 100;
      setProgress(currentProgress);
      
      const watchPercentage = currentProgress;
      setWatchedPercentage(watchPercentage);
      
      // Save resume position every 5 seconds
      if (Math.floor(current) % 5 === 0) {
        saveResumePosition(current, watchPercentage);
      }
      
      // Call progress callback
      if (onProgress) {
        onProgress(watchPercentage);
      }
      
      // Check if video meets completion requirements
      const requiredPercentage = videoContent.settings.requireWatchPercentage;
      if (watchPercentage >= requiredPercentage && !isCompleted) {
        setIsCompleted(true);
        if (videoContent.settings.markAsWatched && onComplete) {
          onComplete();
        }
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setIsCompleted(true);
      
      // Clear resume position when video is completed
      if (videoContent.settings.resumeFromLastPosition) {
        try {
          localStorage.removeItem(resumeStorageKey);
        } catch (error) {
          console.warn('Failed to clear resume position:', error);
        }
      }
      
      if (onComplete) {
        onComplete();
      }
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('ended', handleEnded);
    };
  }, [videoContent, resumeTime, onProgress, onComplete, isCompleted]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
    setIsPlaying(!isPlaying);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (newVolume: number) => {
    const video = videoRef.current;
    if (!video) return;

    video.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const handleSeek = (newProgress: number) => {
    const video = videoRef.current;
    if (!video) return;

    const newTime = (newProgress / 100) * duration;
    video.currentTime = newTime;
    setCurrentTime(newTime);
    setProgress(newProgress);
  };

  const skipTime = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;

    const newTime = Math.max(0, Math.min(duration, currentTime + seconds));
    video.currentTime = newTime;
  };

  const toggleFullscreen = () => {
    const video = videoRef.current;
    if (!video) return;

    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      video.requestFullscreen();
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="relative bg-black rounded-lg overflow-hidden group">
      {/* Video Element */}
      <video
        ref={videoRef}
        src={getVideoSource()}
        poster={videoContent.thumbnail}
        className="w-full h-auto"
        onMouseEnter={() => setShowControls(true)}
        onMouseLeave={() => setShowControls(false)}
      />

      {/* Video Controls Overlay */}
      {showControls && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none">
          <div className="absolute bottom-0 left-0 right-0 p-4 pointer-events-auto">
            {/* Progress Bar */}
            <div className="mb-4">
              <input
                type="range"
                min="0"
                max="100"
                value={progress}
                onChange={(e) => handleSeek(Number(e.target.value))}
                className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-white mt-1">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Control Buttons */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <button
                  onClick={togglePlay}
                  className="text-white hover:text-blue-400 transition-colors"
                >
                  {isPlaying ? <Pause size={24} /> : <Play size={24} />}
                </button>
                
                <button
                  onClick={() => skipTime(-10)}
                  className="text-white hover:text-blue-400 transition-colors"
                >
                  <SkipBack size={20} />
                </button>
                
                <button
                  onClick={() => skipTime(10)}
                  className="text-white hover:text-blue-400 transition-colors"
                >
                  <SkipForward size={20} />
                </button>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={toggleMute}
                    className="text-white hover:text-blue-400 transition-colors"
                  >
                    {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={isMuted ? 0 : volume}
                    onChange={(e) => handleVolumeChange(Number(e.target.value))}
                    className="w-20 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <button className="text-white hover:text-blue-400 transition-colors">
                  <Settings size={20} />
                </button>
                
                <button
                  onClick={toggleFullscreen}
                  className="text-white hover:text-blue-400 transition-colors"
                >
                  <Maximize size={20} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Progress Indicator */}
      <div className="absolute top-4 right-4 bg-black/70 text-white px-3 py-1 rounded text-sm">
        {watchedPercentage.toFixed(0)}% watched
        {isCompleted && <span className="text-green-400 ml-2">✓ Complete</span>}
        {getResumeTime() > 0 && !isPlaying && (
          <div className="text-blue-400 text-xs mt-1">Resume available</div>
        )}
      </div>

      {/* Video Info Overlay (when paused) */}
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <div className="text-center text-white p-6 max-w-md">
            <h3 className="text-xl font-semibold mb-2">{videoContent.title}</h3>
            {videoContent.description && (
              <p className="text-gray-300 text-sm">{videoContent.description}</p>
            )}
            <button
              onClick={togglePlay}
              className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg flex items-center space-x-2 mx-auto transition-colors"
            >
              <Play size={20} />
              <span>Play Video</span>
            </button>
          </div>
        </div>
      )}

      {/* Completion Requirements Notice */}
      {!isCompleted && (
        <div className="absolute bottom-20 left-4 bg-blue-600/90 text-white px-3 py-2 rounded text-sm">
          Watch {videoContent.settings.requireWatchPercentage}% to complete
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;