# Form Validation Integration Guide

**Date:** November 5, 2025  
**Purpose:** Guide for applying input validation and sanitization to all forms  
**Status:** Example implementation complete

---

## ✅ Example Implementation

**File:** `src/pages/LMS/LMSLogin.tsx`

Successfully enhanced with:
- ✅ Zod schema validation
- ✅ Real-time validation error display
- ✅ Input sanitization
- ✅ Accessible error messages
- ✅ Visual error indicators

### Changes Made

```typescript
// 1. Import validators and sanitizers
import { loginSchema, emailSchema } from '../../utils/validators';
import { sanitizeText } from '../../utils/sanitize';

// 2. Add validation error state
const [validationErrors, setValidationErrors] = useState<{ email?: string; password?: string }>({});

// 3. Validate on submit
const validation = loginSchema.safeParse({ email, password });
if (!validation.success) {
  // Display errors
  const errors: { email?: string; password?: string } = {};
  validation.error.errors.forEach((err) => {
    const field = err.path[0] as 'email' | 'password';
    if (field) {
      errors[field] = err.message;
    }
  });
  setValidationErrors(errors);
  return;
}

// 4. Sanitize inputs before use
const sanitizedEmail = sanitizeText(email.toLowerCase().trim());

// 5. Add visual error indicators
<input 
  className={`... ${validationErrors.email ? 'border-red-500' : 'border-gray-300'}`}
  aria-invalid={validationErrors.email ? 'true' : 'false'}
  aria-describedby={validationErrors.email ? 'email-error' : undefined}
/>
{validationErrors.email && (
  <p id="email-error" className="mt-1 text-sm text-red-600">{validationErrors.email}</p>
)}
```

---

## 📋 Forms Requiring Validation

### Authentication Forms (Priority 1 - Critical)

1. **✅ LMS Login** - `src/pages/LMS/LMSLogin.tsx` - COMPLETED
2. **Admin Login** - `src/pages/Admin/AdminLogin.tsx`
   - Schema: `loginSchema`
   - Sanitize: Email
   - Fields: email, password

3. **Registration** (if exists)
   - Schema: `registerSchema`
   - Sanitize: Email, name fields
   - Fields: email, password, confirmPassword, firstName, lastName

### User Management Forms (Priority 2 - High)

4. **Add User Modal** - `src/components/AddUserModal.tsx`
   - Schema: `userSchema`
   - Sanitize: Email, name fields
   - Fields: email, firstName, lastName, role, phone, organizationId

5. **Edit User Profile** - `src/pages/Admin/AdminUserProfile.tsx`
   - Schema: `updateUserSchema`
   - Sanitize: Email, name, phone
   - Fields: firstName, lastName, email, phone, role

6. **Client Profile** - `src/components/ProfileView.tsx`
   - Schema: `updateUserSchema`
   - Sanitize: Name, phone
   - Fields: firstName, lastName, phone

### Organization Forms (Priority 2 - High)

7. **Create Organization** - `src/pages/Admin/AdminOrganizationNew.tsx`
   - Schema: `organizationSchema`
   - Sanitize: Name, description, URL, address
   - Fields: name, description, website, contactEmail, contactPhone, address

8. **Edit Organization** - `src/pages/Admin/OrganizationDetails.tsx`
   - Schema: `organizationSchema`
   - Sanitize: All text fields, URLs
   - Fields: name, description, website, contactEmail, contactPhone, address

### Course Forms (Priority 2 - High)

9. **Course Builder** - `src/pages/Admin/AdminCourseBuilder.tsx`
   - Schema: `courseSchema`, `moduleSchema`, `lessonSchema`
   - Sanitize: **Rich text content with `sanitizeRichText()`**
   - Fields: title, description, content, videoUrl, attachments

10. **Course Create/Edit** - `src/pages/Admin/AdminCourseCreate.tsx`, `AdminCourseEdit.tsx`
    - Schema: `courseSchema`
    - Sanitize: Title, description, tags
    - Fields: title, description, shortDescription, category, tags

11. **Course Settings** - `src/pages/Admin/AdminCourseSettings.tsx`
    - Schema: `courseSchema.partial()`
    - Sanitize: Text fields
    - Fields: duration, prerequisites, learningOutcomes

### Survey Forms (Priority 2 - High)

12. **Survey Builder** - `src/pages/Admin/AdminSurveyBuilder.tsx`
    - Schema: `surveySchema`, `questionSchema`
    - Sanitize: **Rich text with `sanitizeRichText()`**
    - Fields: title, description, questionText, options

13. **Survey Import** - `src/pages/Admin/AdminSurveysImport.tsx`
    - Schema: `surveySchema`
    - Sanitize: **JSON with `sanitizeJSON()`**
    - Validate imported survey structure

14. **Survey Response** (client-side)
    - Schema: `surveyResponseSchema`
    - Sanitize: Text answers
    - Fields: answers (various types)

### Content Forms (Priority 3 - Medium)

15. **Resource Sender** - `src/components/ResourceSender.tsx`
    - Schema: Custom validation
    - Sanitize: Message, recipient selection
    - Fields: recipients, subject, message

16. **Feedback Forms** - `src/pages/LMS/LMSFeedback.tsx`
    - Schema: Custom validation
    - Sanitize: **Basic HTML with `sanitizeBasicHTML()`**
    - Fields: feedback text, rating

17. **Contact Forms** - `src/pages/ContactPage.tsx`, `src/pages/LMS/LMSContact.tsx`
    - Schema: Custom validation
    - Sanitize: Name, email, message
    - Fields: name, email, subject, message

### Document/File Upload Forms (Priority 3 - Medium)

18. **Document Upload** - `src/pages/Admin/AdminDocuments.tsx`
    - Schema: File validation
    - Use: `validateFile()` from validators
    - Check: File type, size, extension

19. **Course Material Upload** (in CourseBuilder)
    - Schema: File validation
    - Use: `validateFile()` with appropriate options
    - Check: Images, videos, documents

---

## 🎯 Implementation Pattern

### Standard Form Validation Pattern

```typescript
import React, { useState } from 'react';
import { yourSchema } from '../../utils/validators';
import { sanitizeText, sanitizeRichText } from '../../utils/sanitize';

const YourForm: React.FC = () => {
  const [formData, setFormData] = useState({ field1: '', field2: '' });
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationErrors({});
    
    // 1. Validate with Zod
    const validation = yourSchema.safeParse(formData);
    if (!validation.success) {
      const errors: Record<string, string> = {};
      validation.error.errors.forEach((err) => {
        const field = err.path[0] as string;
        if (field) {
          errors[field] = err.message;
        }
      });
      setValidationErrors(errors);
      return;
    }
    
    // 2. Sanitize the validated data
    const sanitizedData = {
      field1: sanitizeText(validation.data.field1),
      field2: sanitizeRichText(validation.data.field2),
      // ... sanitize other fields
    };
    
    // 3. Submit sanitized data
    setIsLoading(true);
    try {
      await api.post('/your-endpoint', sanitizedData);
      // Handle success
    } catch (error) {
      // Handle error
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="field1">Field 1</label>
        <input
          id="field1"
          value={formData.field1}
          onChange={(e) => setFormData({ ...formData, field1: e.target.value })}
          className={validationErrors.field1 ? 'border-red-500' : 'border-gray-300'}
          aria-invalid={validationErrors.field1 ? 'true' : 'false'}
          aria-describedby={validationErrors.field1 ? 'field1-error' : undefined}
        />
        {validationErrors.field1 && (
          <p id="field1-error" className="text-sm text-red-600">{validationErrors.field1}</p>
        )}
      </div>
      
      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Submitting...' : 'Submit'}
      </button>
    </form>
  );
};
```

---

## 🛠️ Sanitization Guidelines

### When to Use Each Sanitizer

| Content Type | Sanitizer | Use Case |
|--------------|-----------|----------|
| **Course lessons, survey descriptions** | `sanitizeRichText()` | Full rich text editor content |
| **Comments, feedback** | `sanitizeBasicHTML()` | Basic formatting only |
| **Names, search queries** | `sanitizeText()` | Plain text, remove HTML |
| **Email addresses** | Zod validation only | Built-in email validation |
| **URLs** | `sanitizeURL()` | External links |
| **Filenames** | `sanitizeFilename()` | User-uploaded files |
| **JSON imports** | `sanitizeJSON()` | Imported data structures |

### Rich Text Content Example

```typescript
// Course lesson content
import { sanitizeRichText, createRichTextMarkup } from '../../utils/sanitize';

// Before saving
const handleSave = async (content: string) => {
  const safeContent = sanitizeRichText(content);
  await api.post('/lessons', { content: safeContent });
};

// For display
<div {...createRichTextMarkup(lessonContent)} />
```

### File Upload Example

```typescript
import { validateFile, allowedImageTypes, MAX_IMAGE_SIZE } from '../../utils/validators';
import { sanitizeFilename } from '../../utils/sanitize';

const handleFileUpload = async (file: File) => {
  // Validate file
  const validation = validateFile(file, {
    maxSize: MAX_IMAGE_SIZE,
    allowedTypes: allowedImageTypes,
  });
  
  if (!validation.valid) {
    setError(validation.error);
    return;
  }
  
  // Sanitize filename
  const safeFilename = sanitizeFilename(file.name);
  
  // Upload
  await uploadFile(file, safeFilename);
};
```

---

## ✅ Validation Checklist

For each form, ensure:

- [ ] Import appropriate Zod schema from `utils/validators.ts`
- [ ] Import sanitization functions from `utils/sanitize.ts`
- [ ] Add validation error state: `useState<Record<string, string>>({})`
- [ ] Validate on form submit with `schema.safeParse()`
- [ ] Display validation errors inline with ARIA attributes
- [ ] Add visual indicators (red border) for invalid fields
- [ ] Sanitize all text inputs before submission
- [ ] Use `sanitizeRichText()` for rich text content
- [ ] Use `validateFile()` for file uploads
- [ ] Test with malicious input (XSS attempts, SQL injection)
- [ ] Test with invalid data (empty fields, wrong formats)
- [ ] Verify error messages are user-friendly

---

## 🧪 Testing Each Form

### Manual Testing

```typescript
// Test cases for each form:

1. **Valid Data**: Submit with correct, valid data
   ✓ Form submits successfully
   ✓ No validation errors shown

2. **Invalid Email**: test@invalid (no .com)
   ✓ Email validation error displayed
   ✓ Form does not submit

3. **XSS Attempt**: <script>alert('xss')</script> in text field
   ✓ Script tags removed/escaped
   ✓ Safe content stored

4. **SQL Injection**: '; DROP TABLE users; -- in text field
   ✓ Content properly escaped
   ✓ No database issues

5. **Empty Required Fields**: Submit with empty required fields
   ✓ Validation errors for all empty fields
   ✓ Form does not submit

6. **File Upload (if applicable)**:
   - Upload .exe file
     ✓ Rejected with error message
   - Upload 100MB file
     ✓ Rejected with size error
   - Upload valid image
     ✓ Accepted and uploaded
```

### Automated Testing

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import YourForm from './YourForm';

describe('YourForm', () => {
  it('should validate email format', async () => {
    render(<YourForm />);
    
    const emailInput = screen.getByLabelText('Email');
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
    
    const submitButton = screen.getByText('Submit');
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText(/invalid email/i)).toBeInTheDocument();
    });
  });
  
  it('should sanitize XSS content', async () => {
    render(<YourForm />);
    
    const textInput = screen.getByLabelText('Description');
    fireEvent.change(textInput, { 
      target: { value: '<script>alert("xss")</script>Hello' } 
    });
    
    const submitButton = screen.getByText('Submit');
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      // Verify sanitized content doesn't contain script tags
      expect(mockApiCall).toHaveBeenCalledWith(
        expect.objectContaining({
          description: expect.not.stringContaining('<script>')
        })
      );
    });
  });
});
```

---

## 🔄 Migration Strategy

### Phase 1: Critical Forms (Week 1)
- [x] LMS Login
- [ ] Admin Login
- [ ] User Management Forms

### Phase 2: High-Priority Forms (Week 2)
- [ ] Course Builder
- [ ] Survey Builder
- [ ] Organization Forms

### Phase 3: Medium-Priority Forms (Week 3)
- [ ] Contact Forms
- [ ] Feedback Forms
- [ ] File Upload Forms

### Phase 4: Testing & Cleanup (Week 4)
- [ ] Automated tests for all forms
- [ ] Security audit
- [ ] Performance testing
- [ ] Documentation updates

---

## 📊 Progress Tracking

| Form | Status | Assignee | Notes |
|------|--------|----------|-------|
| LMS Login | ✅ Complete | - | Validation + sanitization implemented |
| Admin Login | 🔄 Pending | - | - |
| Add User Modal | 🔄 Pending | - | - |
| Course Builder | 🔄 Pending | - | Rich text sanitization needed |
| Survey Builder | 🔄 Pending | - | Rich text + JSON validation |
| Organization Forms | 🔄 Pending | - | - |
| Contact Forms | 🔄 Pending | - | - |
| File Upload | 🔄 Pending | - | File validation critical |

---

## 🎉 Next Steps

1. **Apply pattern to Admin Login** (similar to LMS Login)
2. **Update Course Builder** with rich text sanitization
3. **Add file validation** to upload components
4. **Write tests** for validation logic
5. **Security audit** after all forms updated

**Reference:** See completed example in `src/pages/LMS/LMSLogin.tsx`
