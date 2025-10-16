import { describe, it, expect } from 'vitest';
import type { ReactNode } from 'react';
import { render, waitFor } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import SEO from '../components/SEO';

type TestWrapperProps = {
  children: ReactNode;
};

const TestWrapper = ({ children }: TestWrapperProps) => (
  <HelmetProvider>
    {children}
  </HelmetProvider>
);

describe('SEO Component', () => {
  it('renders with default title', async () => {
    render(
      <TestWrapper>
        <SEO />
        <div>Test content</div>
      </TestWrapper>
    );

    await waitFor(() => {
      expect(document.title).toBe('MainProject LMS - Modern Learning Management System');
    });
  });

  it('renders with custom title', async () => {
    render(
      <TestWrapper>
        <SEO title="Custom Page Title" />
        <div>Test content</div>
      </TestWrapper>
    );

    await waitFor(() => {
      expect(document.title).toBe('Custom Page Title | MainProject LMS');
    });
  });

  it('sets meta description', async () => {
    const customDescription = 'Custom description for testing';

    render(
      <TestWrapper>
        <SEO description={customDescription} />
        <div>Test content</div>
      </TestWrapper>
    );

    await waitFor(() => {
      const metaDescription = document.querySelector('meta[name="description"]');
      expect(metaDescription?.getAttribute('content')).toBe(customDescription);
    });
  });

  it('honors an explicit canonical url', async () => {
    const explicitUrl = 'https://example.com/explicit';

    render(
      <TestWrapper>
        <SEO url={explicitUrl} />
        <div>Test content</div>
      </TestWrapper>
    );

    await waitFor(() => {
      const canonical = document.querySelector('link[rel="canonical"]');
      const ogUrl = document.querySelector('meta[property="og:url"]');

      expect(canonical?.getAttribute('href')).toBe(explicitUrl);
      expect(ogUrl?.getAttribute('content')).toBe(explicitUrl);
    });
  });
});
