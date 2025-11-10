import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Helmet } from 'react-helmet-async';
const SEO = ({ title, description = 'Huddle Co. Admin Portal - Manage inclusive leadership training programs, track learner progress, and analyze organizational development metrics.', keywords = ['admin portal', 'learning management', 'inclusive leadership', 'training management', 'analytics dashboard'], ogImage = '/images/admin-og-image.png', ogType = 'website', noIndex = false, canonicalUrl, structuredData }) => {
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
    return (_jsxs(Helmet, { children: [_jsx("title", { children: fullTitle }), _jsx("meta", { name: "description", content: description }), _jsx("meta", { name: "keywords", content: keywords.join(', ') }), _jsx("link", { rel: "canonical", href: currentUrl }), _jsx("meta", { name: "robots", content: noIndex ? 'noindex,nofollow' : 'index,follow' }), _jsx("meta", { property: "og:type", content: ogType }), _jsx("meta", { property: "og:title", content: fullTitle }), _jsx("meta", { property: "og:description", content: description }), _jsx("meta", { property: "og:image", content: ogImage }), _jsx("meta", { property: "og:url", content: currentUrl }), _jsx("meta", { property: "og:site_name", content: baseTitle }), _jsx("meta", { name: "twitter:card", content: "summary_large_image" }), _jsx("meta", { name: "twitter:title", content: fullTitle }), _jsx("meta", { name: "twitter:description", content: description }), _jsx("meta", { name: "twitter:image", content: ogImage }), _jsx("meta", { httpEquiv: "X-Content-Type-Options", content: "nosniff" }), _jsx("meta", { httpEquiv: "X-Frame-Options", content: "DENY" }), _jsx("meta", { httpEquiv: "X-XSS-Protection", content: "1; mode=block" }), _jsx("meta", { name: "theme-color", content: "#3A7DFF" }), _jsx("meta", { name: "apple-mobile-web-app-capable", content: "yes" }), _jsx("meta", { name: "apple-mobile-web-app-status-bar-style", content: "default" }), _jsx("meta", { name: "apple-mobile-web-app-title", content: baseTitle }), _jsx("script", { type: "application/ld+json", children: JSON.stringify(finalStructuredData) })] }));
};
export default SEO;
