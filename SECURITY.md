# SECURITY.md

## Security Policy & Best Practices

### Supported Versions
- Only the latest production branch is actively supported for security updates.

### Reporting a Vulnerability
- Please report security issues to the project maintainer or open a private issue.
- Do **not** disclose vulnerabilities publicly until a fix is released.

### Security Best Practices
- All authentication is server-verified; tokens are never trusted from the client alone.
- All user-generated content is sanitized using DOMPurify.
- All sensitive data is stored in encrypted sessionStorage or httpOnly cookies.
- CSRF protection is enabled for all state-changing endpoints.
- Rate limiting is enforced on all authentication and API endpoints.
- Supabase Row Level Security (RLS) is enabled for all tables.
- All API requests are validated and sanitized using Zod schemas.
- File uploads are validated for type, size, and extension.
- Security headers (CSP, HSTS, etc.) are set in production.

### Security Roadmap
- [x] XSS protection (DOMPurify)
- [x] Encrypted sessionStorage for tokens
- [x] Server-side role verification
- [x] Supabase RLS enabled
- [x] CSRF protection
- [x] Rate limiting
- [ ] Multi-factor authentication (MFA)
- [ ] Audit logging for sensitive actions
- [ ] Automated vulnerability scanning
- [ ] Penetration testing

### Contact
- For urgent security issues, contact the project maintainer via email or private message.
