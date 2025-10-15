import { Helmet } from 'react-helmet-async';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string[];
  ogImage?: string;
  ogType?: 'website' | 'article';
  noIndex?: boolean;
  canonicalUrl?: string;
  structuredData?: object;
}

const SEO: React.FC<SEOProps> = ({
  title,
  description = 'Huddle Co. Admin Portal - Manage inclusive leadership training programs, track learner progress, and analyze organizational development metrics.',
  keywords = ['admin portal', 'learning management', 'inclusive leadership', 'training management', 'analytics dashboard'],
  ogImage = '/images/admin-og-image.png',
  ogType = 'website',
  noIndex = false,
  canonicalUrl,
  structuredData
}) => {
  const baseTitle = 'Huddle Co. Admin Portal';
  const fullTitle = title ? `${title} | ${baseTitle}` : baseTitle;
  const currentUrl = canonicalUrl || window.location.href;

  // Default structured data for the admin portal
  const defaultStructuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    'name': baseTitle,
    'description': description,
    'url': currentUrl,
    'applicationCategory': 'BusinessApplication',
    'operatingSystem': 'Web',
    'offers': {
      '@type': 'Offer',
      'category': 'Educational Software'
    },
    'provider': {
      '@type': 'Organization',
      'name': 'Huddle Co.',
      'url': 'https://huddleco.com'
    }
  };

  const finalStructuredData = structuredData || defaultStructuredData;

  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords.join(', ')} />
      
      {/* Canonical URL */}
      <link rel="canonical" href={currentUrl} />
      
      {/* Robots */}
      <meta name="robots" content={noIndex ? 'noindex,nofollow' : 'index,follow'} />
      
      {/* Open Graph */}
      <meta property="og:type" content={ogType} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:url" content={currentUrl} />
      <meta property="og:site_name" content={baseTitle} />
      
      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
      
      {/* Security Headers */}
      <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
      <meta httpEquiv="X-Frame-Options" content="DENY" />
      <meta httpEquiv="X-XSS-Protection" content="1; mode=block" />
      
      {/* PWA Meta Tags */}
      <meta name="theme-color" content="#3B82F6" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      <meta name="apple-mobile-web-app-title" content={baseTitle} />
      
      {/* Structured Data */}
      <script type="application/ld+json">
        {JSON.stringify(finalStructuredData)}
      </script>
    </Helmet>
  );
};

export default SEO;