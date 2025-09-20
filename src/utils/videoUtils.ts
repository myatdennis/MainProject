// Video utility functions for handling different video sources

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