import { useEffect, useRef, useState } from 'react';
import { enqueueOfflineItem } from '../../dal/offlineQueue';
import { resolveApiUrl } from '../../config/apiBase';

type CaptionTrack = {
  src: string;
  srclang?: string;
  label?: string;
  default?: boolean;
};

type VideoPlayerProps = {
  src: string; // video URL or embed URL
  userId?: string | null;
  lessonId?: string | null;
  captions?: CaptionTrack[];
  className?: string;
  onComplete?: () => void;
};

// Minimal lazy HLS integration that uses hls.js when needed and falls back to native
export default function VideoPlayer({ src, userId, lessonId, captions = [], className, onComplete }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<any>(null);
  const pingTimerRef = useRef<number | null>(null);
  const [ , setReady] = useState(false);
  const [isEmbedded, setIsEmbedded] = useState(false);

  const storageKey = `video_resume:${lessonId ?? src}`;

  useEffect(() => {
    // detect embed providers (YouTube/Vimeo/Loom)
    try {
      const url = new URL(src);
      const host = url.hostname.toLowerCase();
      if (host.includes('youtube.com') || host.includes('youtu.be') || host.includes('vimeo.com') || host.includes('loom.com')) {
        setIsEmbedded(true);
        return;
      }
    } catch (e) {
      // not a valid absolute URL; treat as blob/mp4 path
      /* noop: ignore invalid URL errors */
      void 0;
    }

    let cancelled = false;
    const load = async () => {
      // dynamic import to keep bundle small
      try {
        const Hls = (await import('hls.js')).default;
        const video = videoRef.current;
        if (!video || cancelled) return;

        if (Hls.isSupported() && src.endsWith('.m3u8')) {
          hlsRef.current = new Hls();
          hlsRef.current.loadSource(src);
          hlsRef.current.attachMedia(video);
          hlsRef.current.on(Hls.Events.MANIFEST_PARSED, () => setReady(true));
        } else {
          // native playback for mp4 or when Hls not supported
          video.src = src;
          video.load();
          setReady(true);
        }
      } catch (err) {
        // fallback to native
        const video = videoRef.current;
        if (video) {
          video.src = src;
          video.load();
          setReady(true);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
      if (hlsRef.current) {
        try {
          hlsRef.current.destroy();
        } catch (e) {
          /* noop: ignore HLS destroy errors */
          void 0;
        }
        hlsRef.current = null;
      }
    };
  }, [src]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // restore resume position
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const pos = Number(raw);
        if (!Number.isNaN(pos) && pos > 0) {
          video.currentTime = pos;
        }
      }
    } catch (e) {
      /* noop: localStorage not available or parse failed */
      void 0;
    }

    const onTime = () => {
      try {
        localStorage.setItem(storageKey, String(Math.floor(video.currentTime)));
      } catch (e) {
        /* noop: localStorage may be unavailable */
        void 0;
      }
    };

    const onEnded = () => {
      try {
        localStorage.removeItem(storageKey);
      } catch (e) {
        /* noop: localStorage may be unavailable */
        void 0;
      }
      if (onComplete) onComplete();
    };

    video.addEventListener('timeupdate', onTime);
    video.addEventListener('ended', onEnded);

    return () => {
      video.removeEventListener('timeupdate', onTime);
      video.removeEventListener('ended', onEnded);
    };
  }, [storageKey, onComplete]);

  // periodic watch ping to server (analytics or progress)
  useEffect(() => {
    const ping = async () => {
      const video = videoRef.current;
      if (!video) return;
      const payload: any = {
        event_type: 'video_watch',
        user_id: userId ?? null,
        lesson_id: lessonId ?? null,
        payload: {
          src,
          current_time_s: Math.floor(video.currentTime),
          duration_s: Math.floor(video.duration || 0),
          timestamp: new Date().toISOString()
        }
      };

      try {
        await fetch(resolveApiUrl('/api/analytics/events'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          credentials: 'include',
        });
      } catch (e) {
        // ignore network errors; offline queue handles elsewhere
      }

      // if lessonId and userId provided, also try to update lesson progress/resume endpoint
      if (userId && lessonId) {
        const clientEventId = `${String(userId)}:${String(lessonId)}:${Date.now()}:${Math.random().toString(36).slice(2,8)}`;
        const body = { client_event_id: clientEventId, user_id: userId, lesson_id: lessonId, resume_at_s: Math.floor(video.currentTime), percent: Math.floor(((video.currentTime / (video.duration || 1)) * 100) || 0) };

        // If offline, enqueue the event. If online, attempt to POST and fall back to enqueue on failure.
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          try {
            await enqueueOfflineItem({
              type: 'progress-event',
              userId: String(userId),
              courseId: String(lessonId ?? ''),
              moduleId: undefined,
              lessonId: String(lessonId),
              action: 'progress_update',
              payload: body,
              priority: 'medium',
            });
          } catch (e) {
            // swallow
          }
        } else {
          try {
            const res = await fetch(resolveApiUrl('/api/client/progress/lesson'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
              credentials: 'include',
            });
            if (!res.ok) {
              // enqueue for retry
              await enqueueOfflineItem({
                type: 'progress-event',
                userId: String(userId),
                courseId: String(lessonId ?? ''),
                moduleId: undefined,
                lessonId: String(lessonId),
                action: 'progress_update',
                payload: body,
                priority: 'medium',
              });
            }
          } catch (e) {
            try {
              await enqueueOfflineItem({
                type: 'progress-event',
                userId: String(userId),
                courseId: String(lessonId ?? ''),
                moduleId: undefined,
                lessonId: String(lessonId),
                action: 'progress_update',
                payload: body,
                priority: 'medium',
              });
            } catch (ee) {
              // swallow
            }
          }
        }
      }
    };

    // only ping while playing
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => {
      if (pingTimerRef.current) window.clearInterval(pingTimerRef.current);
      pingTimerRef.current = window.setInterval(() => void ping(), 15000); // every 15s
      // immediate ping
      void ping();
    };

    const onPause = () => {
      if (pingTimerRef.current) {
        window.clearInterval(pingTimerRef.current);
        pingTimerRef.current = null;
      }
    };

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('ended', onPause);

    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('ended', onPause);
      if (pingTimerRef.current) {
        window.clearInterval(pingTimerRef.current);
        pingTimerRef.current = null;
      }
    };
  }, [src, userId, lessonId]);

  if (isEmbedded) {
    // simple iframe embed for YouTube/Vimeo/Loom
    return (
      <div className={className} style={{ position: 'relative', paddingTop: '56.25%' }}>
        <iframe
          src={src}
          title="Embedded video"
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
          frameBorder={0}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <div className={className}>
      <video ref={videoRef} controls style={{ width: '100%', height: 'auto', background: '#000' }}>
        {captions.map((t, i) => (
          <track key={i} src={t.src} kind="subtitles" srcLang={t.srclang} label={t.label} default={t.default} />
        ))}
        Sorry, your browser does not support embedded videos.
      </video>
    </div>
  );
}
