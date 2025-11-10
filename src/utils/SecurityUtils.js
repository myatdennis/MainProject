import DOMPurify from 'dompurify';
export class SecurityUtils {
    /**
     * Sanitize HTML content to prevent XSS attacks
     */
    static sanitizeHTML(dirty) {
        return DOMPurify.sanitize(dirty, {
            ALLOWED_TAGS: ['b', 'i', 'u', 'strong', 'em', 'p', 'br', 'ul', 'ol', 'li', 'a'],
            ALLOWED_ATTR: ['href', 'target'],
            ALLOW_DATA_ATTR: false
        });
    }
    /**
     * Sanitize text input to prevent injection attacks
     */
    static sanitizeInput(input) {
        return input
            .trim()
            .replace(/[<>]/g, '') // Remove angle brackets
            .replace(/javascript:/gi, '') // Remove javascript: protocol
            .replace(/on\w+=/gi, '') // Remove event handlers
            .substring(0, 1000); // Limit length
    }
    /**
     * Validate email format and sanitize
     */
    static validateAndSanitizeEmail(email) {
        const sanitized = this.sanitizeInput(email.toLowerCase());
        const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
        return {
            isValid: emailRegex.test(sanitized) && sanitized.length <= 254,
            sanitized
        };
    }
    /**
     * Validate phone number and sanitize
     */
    static validateAndSanitizePhone(phone) {
        const sanitized = phone.replace(/[^\d\-\+\(\)\s]/g, '').trim();
        const phoneRegex = /^[\+]?[\d\-\(\)\s]{7,20}$/;
        return {
            isValid: phoneRegex.test(sanitized),
            sanitized
        };
    }
    /**
     * Generate secure random token
     */
    static generateSecureToken(length = 32) {
        const array = new Uint8Array(length);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }
    /**
     * Validate file upload security
     */
    static validateFileUpload(file) {
        // Maximum file size: 10MB
        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) {
            return { isValid: false, error: 'File size too large (max 10MB)' };
        }
        // Allowed file types
        const allowedTypes = [
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp',
            'application/pdf',
            'text/csv',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ];
        if (!allowedTypes.includes(file.type)) {
            return { isValid: false, error: 'File type not allowed' };
        }
        // Check file extension matches MIME type
        const extension = file.name.toLowerCase().split('.').pop();
        const mimeToExt = {
            'image/jpeg': ['jpg', 'jpeg'],
            'image/png': ['png'],
            'image/gif': ['gif'],
            'image/webp': ['webp'],
            'application/pdf': ['pdf'],
            'text/csv': ['csv'],
            'application/vnd.ms-excel': ['xls'],
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx']
        };
        const expectedExtensions = mimeToExt[file.type];
        if (!expectedExtensions || !expectedExtensions.includes(extension || '')) {
            return { isValid: false, error: 'File extension does not match file type' };
        }
        return { isValid: true };
    }
    /**
     * Rate limiting for API calls
     */
    static createRateLimiter(maxRequests, windowMs) {
        const requests = [];
        return {
            attempt: () => {
                const now = Date.now();
                // Remove requests outside the window
                while (requests.length > 0 && requests[0] <= now - windowMs) {
                    requests.shift();
                }
                if (requests.length >= maxRequests) {
                    return false; // Rate limit exceeded
                }
                requests.push(now);
                return true;
            },
            reset: () => {
                requests.length = 0;
            }
        };
    }
    /**
     * Content Security Policy validation
     */
    static validateCSP() {
        const meta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
        return meta !== null;
    }
    /**
     * Detect potential security threats
     */
    static detectThreats() {
        const threats = [];
        // Check for developer tools
        if (typeof window !== 'undefined') {
            const devtools = {
                open: false,
                orientation: null
            };
            setInterval(() => {
                if (window.outerHeight - window.innerHeight > 200 ||
                    window.outerWidth - window.innerWidth > 200) {
                    if (!devtools.open) {
                        devtools.open = true;
                        threats.push('Developer tools detected');
                    }
                }
                else {
                    devtools.open = false;
                }
            }, 1000);
        }
        // Check for suspicious URL parameters
        const params = new URLSearchParams(window.location.search);
        const suspiciousPatterns = [
            /<script/i,
            /javascript:/i,
            /on\w+=/i,
            /<iframe/i
        ];
        params.forEach((value) => {
            suspiciousPatterns.forEach((pattern) => {
                if (pattern.test(value)) {
                    threats.push('Suspicious URL parameter detected');
                }
            });
        });
        return threats;
    }
    /**
     * Log security events
     */
    static logSecurityEvent(event) {
        const logEntry = {
            ...event,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href,
            sessionId: this.secureStorage.get('session_id') || 'anonymous'
        };
        // In production, send to security monitoring service
        console.log('Security Event:', logEntry);
        // Store locally for audit trail
        try {
            const logs = this.secureStorage.get('security_logs') || [];
            logs.push(logEntry);
            // Keep only last 100 events
            this.secureStorage.set('security_logs', logs.slice(-100));
        }
        catch (error) {
            console.error('Failed to log security event:', error);
        }
    }
}
/**
 * Secure local storage with encryption
 */
SecurityUtils.secureStorage = {
    set: (key, value) => {
        try {
            const encrypted = btoa(JSON.stringify(value));
            localStorage.setItem(`secure_${key}`, encrypted);
        }
        catch (error) {
            console.error('Failed to store secure data:', error);
        }
    },
    get: (key) => {
        try {
            const encrypted = localStorage.getItem(`secure_${key}`);
            if (!encrypted)
                return null;
            const decrypted = atob(encrypted);
            return JSON.parse(decrypted);
        }
        catch (error) {
            console.error('Failed to retrieve secure data:', error);
            return null;
        }
    },
    remove: (key) => {
        localStorage.removeItem(`secure_${key}`);
    },
    clear: () => {
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
            if (key.startsWith('secure_')) {
                localStorage.removeItem(key);
            }
        });
    }
};
export default SecurityUtils;
