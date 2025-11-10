# TESTING.md

## Testing Strategy

### Unit Testing
- All business logic in `src/services/` and `src/dal/` should have unit tests.
- Use [Vitest](https://vitest.dev/) for all new tests.
- Run tests with `npm test` or `npm run test:unit`.

### Integration Testing
- Use Playwright for E2E tests (`npm run test:e2e`).
- Test all critical user flows: login, course progress, survey submission, admin actions.
- Use demo credentials for E2E: see `README.md`.

### Security Testing
- Add tests for XSS sanitization, token expiration, and role-based access.
- See `SECURITY_AUDIT_FIXES.md` for sample security tests.

### Coverage
- Run `npm run test:coverage` to check code coverage.
- Aim for >60% coverage on all business logic.

### Manual Testing
- Test on latest Chrome, Firefox, Safari, and Edge.
- Verify accessibility with screen readers and keyboard navigation.

---

For more details, see the audit and security docs, or contact the project maintainer.
