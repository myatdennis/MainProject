import type { LessonContent } from '../types/courseTypes';
import { canonicalizeLessonContent } from './lessonContent';

// Video utility functions for handling different video sources

export type ResolvedVideoPlayback = {
  src: string | null;
  embedUrl: string | null;
  provider: 'youtube' | 'vimeo' | 'ted' | 'loom' | 'external' | 'internal' | 'unknown';
  mode: 'embed' | 'native' | 'none';
};

export const extractVideoId = (url: string): { type: 'youtube' | 'vimeo' | 'external' | null, id: string | null } => {
  if (!url) return { type: null, id: null };

  // YouTube patterns
  const youtubePatterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/watch\?.*v=([^&\n?#]+)/
  ];

  for (const pattern of youtubePatterns) {
    const match = url.match(pattern);
    if (match) {
      return { type: 'youtube', id: match[1] };
    }
  }

  // Vimeo patterns
  const vimeoPatterns = [
    /vimeo\.com\/(\d+)/,
    /player\.vimeo\.com\/video\/(\d+)/
  ];

  for (const pattern of vimeoPatterns) {
    const match = url.match(pattern);
    if (match) {
      return { type: 'vimeo', id: match[1] };
    }
  }

  // If it's a valid URL but not YouTube or Vimeo, treat as external
  try {
    new URL(url);
    return { type: 'external', id: url };
  } catch {
    return { type: null, id: null };
  }
};

export const getVideoEmbedUrl = (content: any): string | null => {
  if (content.videoSourceType === 'youtube' && content.externalVideoId) {
    return `https://www.youtube.com/embed/${content.externalVideoId}?enablejsapi=1&origin=${window.location.origin}`;
  } else if (content.videoSourceType === 'vimeo' && content.externalVideoId) {
    return `https://player.vimeo.com/video/${content.externalVideoId}`;
  } else if (content.videoSourceType === 'external' && content.videoUrl) {
    return content.videoUrl;
  }
  return null;
};

export const getVideoThumbnail = (content: any): string | null => {
  if (content.videoSourceType === 'youtube' && content.externalVideoId) {
    return `https://img.youtube.com/vi/${content.externalVideoId}/maxresdefault.jpg`;
  } else if (content.videoSourceType === 'vimeo' && content.externalVideoId) {
    // Vimeo thumbnails require API call, return placeholder
    return 'https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg?auto=compress&cs=tinysrgb&w=800';
  }
  return null;
};

export const validateVideoUrl = (url: string): boolean => {
  const { type } = extractVideoId(url);
  return type !== null;
};

export type ExternalVideoCommitMetadata = {
  isValid: boolean;
  normalizedUrl: string;
  sourceType: 'youtube' | 'vimeo' | 'external';
  videoProvider?: 'youtube' | 'vimeo' | 'native';
  externalVideoId?: string;
};

export const deriveExternalVideoCommitMetadata = (rawUrl: string): ExternalVideoCommitMetadata => {
  const normalizedUrl = rawUrl.trim();

  if (!normalizedUrl) {
    return {
      isValid: true,
      normalizedUrl: '',
      sourceType: 'external',
    };
  }

  const { type, id } = extractVideoId(normalizedUrl);
  if (!type || !id) {
    return {
      isValid: false,
      normalizedUrl,
      sourceType: 'external',
    };
  }

  if (type === 'youtube') {
    return {
      isValid: true,
      normalizedUrl,
      sourceType: 'youtube',
      videoProvider: 'youtube',
      externalVideoId: id,
    };
  }

  if (type === 'vimeo') {
    return {
      isValid: true,
      normalizedUrl,
      sourceType: 'vimeo',
      videoProvider: 'vimeo',
      externalVideoId: id,
    };
  }

  return {
    isValid: true,
    normalizedUrl,
    sourceType: 'external',
    videoProvider: 'native',
    externalVideoId: id,
  };
};

export const getVideoSourceInfo = (url: string): { 
  sourceType: 'internal' | 'youtube' | 'vimeo' | 'external';
  videoId: string;
  embedUrl: string;
} | null => {
  const { type, id } = extractVideoId(url);
  
  if (!type || !id) return null;

  let embedUrl = '';
  if (type === 'youtube') {
    embedUrl = `https://www.youtube.com/embed/${id}?enablejsapi=1&origin=${window.location.origin}`;
  } else if (type === 'vimeo') {
    embedUrl = `https://player.vimeo.com/video/${id}`;
  } else if (type === 'external') {
    embedUrl = id; // For external, the id is the full URL
  }

  return {
    sourceType: type,
    videoId: id,
    embedUrl
  };
};

const toEmbedUrl = (provider: ResolvedVideoPlayback['provider'], videoUrl: string): string | null => {
  if (provider === 'youtube') {
    const info = getVideoSourceInfo(videoUrl);
    if (info?.sourceType === 'youtube' && info.videoId) {
      return `https://www.youtube.com/embed/${info.videoId}`;
    }
    return null;
  }

  if (provider === 'vimeo') {
    const info = getVideoSourceInfo(videoUrl);
    if (info?.sourceType === 'vimeo' && info.videoId) {
      return `https://player.vimeo.com/video/${info.videoId}`;
    }
    return null;
  }

  if (provider === 'ted') {
    if (videoUrl.includes('embed.ted.com/talks')) return videoUrl;
    if (videoUrl.includes('ted.com/talks')) {
      return videoUrl.replace('www.ted.com/talks', 'embed.ted.com/talks');
    }
    return videoUrl;
  }

  if (provider === 'loom') {
    return videoUrl;
  }

  return null;
};

export const resolveLessonVideoPlayback = (content?: LessonContent | null): ResolvedVideoPlayback => {
  const normalized = canonicalizeLessonContent(content ?? undefined);
  const videoUrl = normalized.videoUrl?.trim() || null;
  const explicitSourceType = normalized.videoSourceType?.toLowerCase() || null;
  const explicitProvider = normalized.videoProvider?.toLowerCase() || null;

  if (!videoUrl) {
    return { src: null, embedUrl: null, provider: 'unknown', mode: 'none' };
  }

  const lowerUrl = videoUrl.toLowerCase();
  const provider: ResolvedVideoPlayback['provider'] =
    explicitProvider === 'youtube' || explicitSourceType === 'youtube' || lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')
      ? 'youtube'
      : explicitProvider === 'vimeo' || explicitSourceType === 'vimeo' || lowerUrl.includes('vimeo.com')
      ? 'vimeo'
      : explicitProvider === 'ted' || lowerUrl.includes('ted.com/talks') || lowerUrl.includes('embed.ted.com/talks')
      ? 'ted'
      : explicitProvider === 'loom' || lowerUrl.includes('loom.com')
      ? 'loom'
      : explicitSourceType === 'internal'
      ? 'internal'
      : explicitSourceType === 'external'
      ? 'external'
      : 'unknown';

  const embedUrl = toEmbedUrl(provider, videoUrl);
  const mode =
    provider === 'youtube' || provider === 'vimeo' || provider === 'ted' || provider === 'loom'
      ? 'embed'
      : 'native';

  return {
    src: videoUrl,
    embedUrl,
    provider,
    mode,
  };
};
