/**
 * Input Validation Schemas
 * Comprehensive Zod schemas for all user inputs
 */
import { z } from 'zod';
// ============================================================================
// Authentication Schemas
// ============================================================================
export const emailSchema = z
    .string()
    .email('Invalid email address')
    .max(255, 'Email too long')
    .toLowerCase()
    .trim();
export const passwordSchema = z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 'Password must contain uppercase, lowercase, number, and special character');
export const loginSchema = z.object({
    email: emailSchema,
    password: z.string().min(1, 'Password is required'),
});
export const registerSchema = z.object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    firstName: z.string().min(1, 'First name is required').max(100).trim(),
    lastName: z.string().min(1, 'Last name is required').max(100).trim(),
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
});
// ============================================================================
// User Schemas
// ============================================================================
export const nameSchema = z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name too long')
    .regex(/^[a-zA-Z0-9\s'\-À-ÿ]+$/, 'Invalid characters in name')
    .trim();
export const phoneSchema = z
    .string()
    .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number')
    .optional()
    .or(z.literal(''));
export const roleSchema = z.enum(['admin', 'user', 'client', 'instructor']);
export const userSchema = z.object({
    id: z.string().uuid().optional(),
    email: emailSchema,
    firstName: nameSchema,
    lastName: nameSchema,
    role: roleSchema,
    phone: phoneSchema,
    organizationId: z.string().uuid().optional().nullable(),
    isActive: z.boolean().default(true),
    createdAt: z.string().datetime().optional(),
    updatedAt: z.string().datetime().optional(),
});
export const updateUserSchema = userSchema.partial().omit({ id: true, createdAt: true });
// ============================================================================
// Organization Schemas
// ============================================================================
export const organizationNameSchema = z
    .string()
    .min(1, 'Organization name is required')
    .max(200, 'Organization name too long')
    .trim();
export const urlSchema = z
    .string()
    .url('Invalid URL')
    .max(500, 'URL too long')
    .optional()
    .or(z.literal(''));
export const organizationSchema = z.object({
    id: z.string().uuid().optional(),
    name: organizationNameSchema,
    description: z.string().max(2000, 'Description too long').optional(),
    website: urlSchema,
    contactEmail: emailSchema.optional(),
    contactPhone: phoneSchema,
    address: z.string().max(500, 'Address too long').optional(),
    isActive: z.boolean().default(true),
    createdAt: z.string().datetime().optional(),
});
// ============================================================================
// Course Schemas
// ============================================================================
export const courseNameSchema = z
    .string()
    .min(1, 'Course name is required')
    .max(200, 'Course name too long')
    .trim();
export const courseDescriptionSchema = z
    .string()
    .max(5000, 'Description too long')
    .optional();
export const durationSchema = z
    .number()
    .min(0, 'Duration must be positive')
    .max(10000, 'Duration too long');
export const courseSchema = z.object({
    id: z.string().uuid().optional(),
    title: courseNameSchema,
    description: courseDescriptionSchema,
    shortDescription: z.string().max(500, 'Short description too long').optional(),
    category: z.string().max(100).optional(),
    level: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
    duration: durationSchema.optional(),
    thumbnailUrl: urlSchema,
    isPublished: z.boolean().default(false),
    isFeatured: z.boolean().default(false),
    tags: z.array(z.string().max(50)).max(20, 'Too many tags').optional(),
    prerequisites: z.array(z.string()).optional(),
    learningOutcomes: z.array(z.string()).optional(),
    createdBy: z.string().uuid().optional(),
    createdAt: z.string().datetime().optional(),
    updatedAt: z.string().datetime().optional(),
});
export const moduleSchema = z.object({
    id: z.string().uuid().optional(),
    courseId: z.string().uuid(),
    title: courseNameSchema,
    description: courseDescriptionSchema,
    order: z.number().min(0),
    duration: durationSchema.optional(),
    isRequired: z.boolean().default(true),
});
export const lessonSchema = z.object({
    id: z.string().uuid().optional(),
    moduleId: z.string().uuid(),
    title: courseNameSchema,
    content: z.string().max(50000, 'Content too long'),
    contentType: z.enum(['text', 'video', 'audio', 'interactive', 'quiz']),
    order: z.number().min(0),
    duration: durationSchema.optional(),
    videoUrl: urlSchema,
    attachments: z.array(z.object({
        name: z.string().max(255),
        url: z.string().url('Invalid URL').max(500),
        type: z.string().max(100),
    })).optional(),
});
// ============================================================================
// Survey Schemas
// ============================================================================
export const surveySchema = z.object({
    id: z.string().uuid().optional(),
    title: z.string().min(1, 'Survey title is required').max(200).trim(),
    description: z.string().max(2000).optional(),
    isActive: z.boolean().default(false),
    isAnonymous: z.boolean().default(false),
    allowMultipleResponses: z.boolean().default(false),
    startDate: z.string().datetime().optional().nullable(),
    endDate: z.string().datetime().optional().nullable(),
    createdBy: z.string().uuid().optional(),
    createdAt: z.string().datetime().optional(),
});
export const questionSchema = z.object({
    id: z.string().uuid().optional(),
    surveyId: z.string().uuid(),
    questionText: z.string().min(1, 'Question text is required').max(1000),
    questionType: z.enum(['multiple_choice', 'text', 'rating', 'yes_no', 'matrix']),
    order: z.number().min(0),
    isRequired: z.boolean().default(false),
    options: z.array(z.string().max(500)).optional(),
    validationRules: z.record(z.any()).optional(),
});
export const surveyResponseSchema = z.object({
    id: z.string().uuid().optional(),
    surveyId: z.string().uuid(),
    userId: z.string().uuid().optional().nullable(),
    answers: z.array(z.object({
        questionId: z.string().uuid(),
        answer: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
    })),
    submittedAt: z.string().datetime().optional(),
});
// ============================================================================
// File Upload Schemas
// ============================================================================
export const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
export const allowedDocumentTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];
export const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/ogg'];
export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
export function validateFile(file, options = {}) {
    const { maxSize = MAX_FILE_SIZE, allowedTypes = [] } = options;
    // Check file size
    if (file.size > maxSize) {
        return {
            valid: false,
            error: `File too large. Maximum size: ${maxSize / 1024 / 1024}MB`,
        };
    }
    // Check file type
    if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
        return {
            valid: false,
            error: `Invalid file type. Allowed: ${allowedTypes.join(', ')}`,
        };
    }
    // Check file extension matches MIME type
    const extension = file.name.split('.').pop()?.toLowerCase();
    const mimeToExtension = {
        'image/jpeg': ['jpg', 'jpeg'],
        'image/png': ['png'],
        'image/gif': ['gif'],
        'image/webp': ['webp'],
        'application/pdf': ['pdf'],
        'application/msword': ['doc'],
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
        'video/mp4': ['mp4'],
        'video/webm': ['webm'],
    };
    const expectedExtensions = mimeToExtension[file.type];
    if (expectedExtensions && extension && !expectedExtensions.includes(extension)) {
        return {
            valid: false,
            error: 'File extension does not match file type',
        };
    }
    return { valid: true };
}
// ============================================================================
// Search & Filter Schemas
// ============================================================================
export const searchSchema = z.object({
    query: z.string().max(200).trim(),
    page: z.number().min(1).default(1),
    limit: z.number().min(1).max(100).default(20),
    sortBy: z.string().max(50).optional(),
    sortOrder: z.enum(['asc', 'desc']).default('asc'),
});
export const dateRangeSchema = z.object({
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
}).refine((data) => new Date(data.startDate) <= new Date(data.endDate), {
    message: 'End date must be after start date',
    path: ['endDate'],
});
// ============================================================================
// ID Validation
// ============================================================================
export const uuidSchema = z.string().uuid('Invalid ID format');
export function validateUUID(id) {
    return uuidSchema.safeParse(id).success;
}
// ============================================================================
// Validation Helper Functions
// ============================================================================
export function safeValidate(schema, data) {
    const result = schema.safeParse(data);
    if (result.success) {
        return { success: true, data: result.data };
    }
    const errorMessage = result.error.errors
        .map((err) => `${err.path.join('.')}: ${err.message}`)
        .join('; ');
    return { success: false, error: errorMessage };
}
export function validateOrThrow(schema, data) {
    return schema.parse(data);
}
