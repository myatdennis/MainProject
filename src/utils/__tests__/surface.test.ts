import { describe, it, expect } from 'vitest';
import { isAdminSurface, isLoginPath, resolveLoginPath } from '../surface';

describe('surface utils', () => {
  it('detects admin surface from admin path fragments', () => {
    expect(isAdminSurface('/admin')).toBe(true);
    expect(isAdminSurface('/admin/dashboard')).toBe(true);
    expect(isAdminSurface('#/admin/login')).toBe(true);
  });

  it('detects admin surface from exact admin query params', () => {
    expect(isAdminSurface('/login?admin=1')).toBe(true);
    expect(isAdminSurface('/login?admin=true')).toBe(true);
    expect(isAdminSurface('/login?admin=yes')).toBe(true);
    expect(isAdminSurface('/login?admin=')).toBe(true);
    expect(isAdminSurface('/login?surface=admin')).toBe(true);
    expect(isAdminSurface('/login?role=admin')).toBe(true);
  });

  it('does not treat unrelated query strings as admin surface', () => {
    expect(isAdminSurface('/login?admin=0')).toBe(false);
    expect(isAdminSurface('/login?admin=false')).toBe(false);
    expect(isAdminSurface('/login?utm_source=admin')).toBe(false);
    expect(isAdminSurface('/login?source=admin')).toBe(false);
    expect(isAdminSurface('/login?surface=client')).toBe(false);
  });

  it('supports full URL strings for admin detection', () => {
    expect(isAdminSurface('https://example.com/login?admin=1')).toBe(true);
    expect(isAdminSurface('https://example.com/login?utm_admin=1')).toBe(false);
  });

  it('detects login paths for admin, login, and lms login routes', () => {
    expect(isLoginPath('/login')).toBe(true);
    expect(isLoginPath('/lms/login')).toBe(true);
    expect(isLoginPath('/admin/login')).toBe(true);
    expect(isLoginPath('/admin/dashboard')).toBe(false);
  });

  it('resolves login path correctly for admin and non-admin surfaces', () => {
    expect(resolveLoginPath('/login?admin=1')).toBe('/admin/login');
    expect(resolveLoginPath('/login?role=admin')).toBe('/admin/login');
    expect(resolveLoginPath('/login')).toBe('/login');
  });
});
