import React from 'react';
import { Helmet } from 'react-helmet-async';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  url?: string;
  type?: string;
}

const isBrowser = typeof window !== 'undefined' && typeof window.location !== 'undefined';

const resolveUrl = (explicitUrl?: string): string | undefined => {
  if (explicitUrl && explicitUrl.trim().length > 0) {
    return explicitUrl.trim();
  }

  if (isBrowser) {
    return window.location.href;
  }

  if (typeof globalThis !== 'undefined') {
    const locationLike = (globalThis as { location?: { href?: string } }).location;
    if (locationLike?.href) {
      return locationLike.href;
    }
  }

  return undefined;
};

const SEO: React.FC<SEOProps> = ({
  title = 'MainProject LMS - Modern Learning Management System',
  description = 'Comprehensive Learning Management System with course creation, survey tools, and analytics. Transform your training programs with our modern LMS platform.',
  keywords = 'LMS, Learning Management System, Online Training, Course Creation, E-learning, Educational Technology',
  image = '/og-image.png',
  url,
  type = 'website',
}) => {
  const fullTitle = title.includes('MainProject LMS') ? title : `${title} | MainProject LMS`;
  const canonicalUrl = resolveUrl(url);

  return (
    <Helmet prioritizeSeoTags>
      {/* Basic Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      {canonicalUrl && <meta property="og:url" content={canonicalUrl} />}

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {/* Canonical URL */}
      {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}
    </Helmet>
  );
};

export default SEO;
