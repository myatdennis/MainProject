import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import SEO from '../components/SEO';

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <HelmetProvider>
    <BrowserRouter>
      {children}
    </BrowserRouter>
  </HelmetProvider>
);

describe('SEO Component', () => {
  it('renders with default title', () => {
    render(
      <TestWrapper>
        <SEO />
        <div>Test content</div>
      </TestWrapper>
    );
    
    expect(document.title).toBe('MainProject LMS - Modern Learning Management System');
  });

  it('renders with custom title', () => {
    render(
      <TestWrapper>
        <SEO title="Custom Page Title" />
        <div>Test content</div>
      </TestWrapper>
    );
    
    expect(document.title).toBe('Custom Page Title | MainProject LMS');
  });

  it('sets meta description', () => {
    const customDescription = 'Custom description for testing';
    
    render(
      <TestWrapper>
        <SEO description={customDescription} />
        <div>Test content</div>
      </TestWrapper>
    );
    
    const metaDescription = document.querySelector('meta[name="description"]');
    expect(metaDescription?.getAttribute('content')).toBe(customDescription);
  });
});