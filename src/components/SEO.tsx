import React from 'react';
import { Helmet } from 'react-helmet-async';

interface SEOProps {
  title?: string;
  description?: string;
  canonical?: string;
  ogType?: 'website' | 'article' | 'profile';
  ogImage?: string;
  structuredData?: object;
}

export function SEO({ 
  title = "AnyTrader | Place for every skill", 
  description = "AnyTrader is the UK's leading marketplace for professional trades and community help. Post jobs, get AI estimates, and hire verified experts.",
  canonical,
  ogType = 'website',
  ogImage = "https://picsum.photos/seed/anytrader-seo/1200/630",
  structuredData
}: SEOProps) {
  const siteName = "AnyTrader";
  const fullTitle = title.includes(siteName) ? title : `${title} | ${siteName}`;

  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {canonical && <link rel="canonical" href={canonical} />}

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={ogType} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:site_name" content={siteName} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {/* AI Search Optimization (GEO) */}
      <meta name="robots" content="index, follow" />
      <meta name="googlebot" content="index, follow" />
      
      {/* Structured Data (JSON-LD) */}
      {structuredData && (
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      )}

      {/* Default Organization Structured Data if no specific data provided */}
      {!structuredData && (
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            "name": "AnyTrader",
            "url": window.location.origin,
            "logo": `${window.location.origin}/logo.png`,
            "description": description,
            "sameAs": [
              "https://twitter.com/anytrader",
              "https://facebook.com/anytrader"
            ]
          })}
        </script>
      )}
    </Helmet>
  );
}
