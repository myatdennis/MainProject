/**
 * XSS Protection and Content Sanitization
 * Utilities to prevent cross-site scripting attacks
 */

import DOMPurify from 'dompurify';

// ============================================================================
// HTML Sanitization
// ============================================================================

interface SanitizeOptions {
  allowedTags?: string[];
  allowedAttributes?: string[];
  allowDataAttributes?: boolean;
}

/**
 * Sanitize HTML content to prevent XSS attacks
 * Use this for all user-generated content displayed as HTML
 */
export function sanitizeHTML(
  dirty: string,
  options: SanitizeOptions = {}
): string {
  const {
    allowedTags = [
      'p', 'br', 'strong', 'em', 'u', 'a', 'ul', 'ol', 'li',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'blockquote', 'code', 'pre',
      'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
    ],
    allowedAttributes = ['href', 'target', 'rel', 'src', 'alt', 'title', 'class'],
    allowDataAttributes = false,
  } = options;

  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: allowedTags,
    ALLOWED_ATTR: allowedAttributes,
    ALLOW_DATA_ATTR: allowDataAttributes,
    ALLOW_ARIA_ATTR: true,
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
    RETURN_TRUSTED_TYPE: false,
  });
}

/**
 * Sanitize HTML for rich text content (course lessons, survey descriptions)
 */
export function sanitizeRichText(dirty: string): string {
  return sanitizeHTML(dirty, {
    allowedTags: [
      'p', 'br', 'strong', 'em', 'u', 'a', 'ul', 'ol', 'li',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'blockquote', 'code', 'pre', 'hr',
      'img', 'video', 'audio',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'div', 'span',
    ],
    allowedAttributes: [
      'href', 'target', 'rel', 'src', 'alt', 'title',
      'class', 'id', 'width', 'height',
      'controls', 'autoplay', 'loop', 'muted',
    ],
    allowDataAttributes: false,
  });
}

/**
 * Sanitize HTML for basic formatting only (comments, feedback)
 */
export function sanitizeBasicHTML(dirty: string): string {
  return sanitizeHTML(dirty, {
    allowedTags: ['p', 'br', 'strong', 'em', 'u', 'a', 'ul', 'ol', 'li'],
    allowedAttributes: ['href', 'target', 'rel'],
    allowDataAttributes: false,
  });
}

/**
 * Strip all HTML tags, return plain text only
 */
export function stripHTML(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });
}

// ============================================================================
// Text Sanitization
// ============================================================================

/**
 * Sanitize plain text to prevent script injection
 * Use for text inputs that will be displayed as-is
 */
export function sanitizeText(text: string): string {
  return text
    .replace(/[<>]/g, '') // Remove angle brackets
    .trim();
}

/**
 * Sanitize user name (allow letters, numbers, spaces, hyphens, apostrophes)
 */
export function sanitizeName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9\s'\-À-ÿ]/g, '') // Allow Unicode letters
    .trim();
}

/**
 * Sanitize search query
 */
export function sanitizeSearchQuery(query: string): string {
  return query
    .replace(/[<>'"]/g, '') // Remove potentially dangerous characters
    .slice(0, 200) // Limit length
    .trim();
}

// ============================================================================
// URL Sanitization
// ============================================================================

/**
 * Validate and sanitize URL
 */
export function sanitizeURL(url: string): string | null {
  try {
    const parsedURL = new URL(url);
    
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsedURL.protocol)) {
      return null;
    }
    
    return parsedURL.toString();
  } catch {
    return null;
  }
}

/**
 * Check if URL is safe for embedding (images, videos)
 */
export function isSafeEmbedURL(url: string): boolean {
  const safe = sanitizeURL(url);
  if (!safe) return false;
  
  // Add whitelist of trusted domains if needed
  const trustedDomains = [
    'youtube.com',
    'youtu.be',
    'vimeo.com',
    'imgur.com',
    // Add your CDN domains
  ];
  
  try {
    const parsedURL = new URL(safe);
    const hostname = parsedURL.hostname.toLowerCase();
    
    // Check if domain matches trusted list
    return trustedDomains.some(domain => 
      hostname === domain || hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

// ============================================================================
// JSON Sanitization
// ============================================================================

/**
 * Safely parse JSON and sanitize string values
 */
export function sanitizeJSON<T>(jsonString: string): T | null {
  try {
    const parsed = JSON.parse(jsonString);
    return sanitizeObject(parsed);
  } catch {
    return null;
  }
}

/**
 * Recursively sanitize object properties
 */
function sanitizeObject<T>(obj: any): T {
  if (typeof obj === 'string') {
    return sanitizeText(obj) as any;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item)) as any;
  }
  
  if (obj && typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized;
  }
  
  return obj;
}

// ============================================================================
// Filename Sanitization
// ============================================================================

/**
 * Generate safe filename from user input
 */
export function sanitizeFilename(filename: string): string {
  // Remove path traversal attempts
  let safe = filename.replace(/\.\./g, '');
  
  // Remove or replace unsafe characters
  safe = safe.replace(/[^a-zA-Z0-9._\-]/g, '_');
  
  // Limit length
  safe = safe.slice(0, 255);
  
  // Ensure it has an extension
  if (!safe.includes('.')) {
    safe += '.txt';
  }
  
  // Prevent hidden files
  if (safe.startsWith('.')) {
    safe = '_' + safe;
  }
  
  return safe;
}

// ============================================================================
// SQL Injection Prevention (for raw queries)
// ============================================================================

/**
 * Escape string for use in SQL LIKE queries
 * Note: Use parameterized queries when possible
 */
export function escapeSQLLike(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');
}

// ============================================================================
// Content Security Policy Helpers
// ============================================================================

/**
 * Generate a nonce for inline scripts (use with CSP)
 */
export function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Check if content contains potential XSS
 */
export function containsXSS(content: string): boolean {
  const xssPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i, // Event handlers like onclick=
    /<iframe/i,
    /<object/i,
    /<embed/i,
  ];
  
  return xssPatterns.some(pattern => pattern.test(content));
}

/**
 * Check if content is safe (doesn't contain XSS)
 */
export function isSafeContent(content: string): boolean {
  return !containsXSS(content);
}

// ============================================================================
// React Helper
// ============================================================================

/**
 * Safe dangerouslySetInnerHTML wrapper
 * Usage: <div {...createMarkup(userContent)} />
 */
export function createMarkup(html: string, options?: SanitizeOptions) {
  return {
    dangerouslySetInnerHTML: {
      __html: sanitizeHTML(html, options),
    },
  };
}

/**
 * Safe rich text markup for course content
 */
export function createRichTextMarkup(html: string) {
  return {
    dangerouslySetInnerHTML: {
      __html: sanitizeRichText(html),
    },
  };
}
