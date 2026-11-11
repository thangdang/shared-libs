/**
 * Structured Data Builders - Nov 2026 Release
 * 
 * JSON-LD structured data builders for all 5 apps.
 * 
 * @author Solo Dev
 * @release Nov 2026
 */

import type { BreadcrumbItem, StructuredDataConfig } from './types';

// ═══════════════════════════════════════════════════════════════
//  COMMON STRUCTURED DATA
// ═══════════════════════════════════════════════════════════════

/**
 * Build Organization structured data
 */
export function buildOrganization(config: {
  name: string;
  url: string;
  logo: string;
  description?: string;
  sameAs?: string[];
}): StructuredDataConfig {
  return {
    type: 'Organization',
    data: {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: config.name,
      url: config.url,
      logo: config.logo,
      description: config.description,
      sameAs: config.sameAs || [],
    },
  };
}

/**
 * Build WebSite structured data (for search box)
 */
export function buildWebSite(config: {
  name: string;
  url: string;
  searchUrl?: string;
  searchQueryInput?: string;
}): StructuredDataConfig {
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: config.name,
    url: config.url,
  };

  if (config.searchUrl) {
    data.potentialAction = {
      '@type': 'SearchAction',
      target: config.searchUrl + '{search_term_string}',
      'query-input': config.searchQueryInput || 'required name=search_term_string',
    };
  }

  return { type: 'WebSite', data };
}

/**
 * Build BreadcrumbList structured data
 */
export function buildBreadcrumbs(items: BreadcrumbItem[]): StructuredDataConfig {
  return {
    type: 'BreadcrumbList',
    data: {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: items.map((item, index) => ({
        '@type': 'ListItem',
        position: item.position ?? index + 1,
        name: item.name,
        item: item.url,
      })),
    },
  };
}

// ═══════════════════════════════════════════════════════════════
//  TRENDBRIEF - NEWS/ARTICLE STRUCTURED DATA
// ═══════════════════════════════════════════════════════════════

/**
 * Build NewsArticle structured data (TrendBrief)
 */
export function buildNewsArticle(config: {
  headline: string;
  description: string;
  image: string | string[];
  datePublished: string;
  dateModified?: string;
  author: string;
  publisher: { name: string; logo: string };
  mainEntityOfPage: string;
}): StructuredDataConfig {
  return {
    type: 'NewsArticle',
    data: {
      '@context': 'https://schema.org',
      '@type': 'NewsArticle',
      headline: config.headline,
      description: config.description,
      image: config.image,
      datePublished: config.datePublished,
      dateModified: config.dateModified || config.datePublished,
      author: {
        '@type': 'Person',
        name: config.author,
      },
      publisher: {
        '@type': 'Organization',
        name: config.publisher.name,
        logo: {
          '@type': 'ImageObject',
          url: config.publisher.logo,
        },
      },
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': config.mainEntityOfPage,
      },
    },
  };
}

// ═══════════════════════════════════════════════════════════════
//  SMARTBUY - PRODUCT STRUCTURED DATA
// ═══════════════════════════════════════════════════════════════

/**
 * Build Product structured data (SmartBuy)
 */
export function buildProduct(config: {
  name: string;
  description: string;
  image: string | string[];
  brand?: string;
  sku?: string;
  offers: Array<{
    price: number;
    currency: string;
    seller: string;
    url: string;
    availability: 'InStock' | 'OutOfStock' | 'PreOrder';
  }>;
  aggregateRating?: {
    ratingValue: number;
    reviewCount: number;
  };
}): StructuredDataConfig {
  return {
    type: 'Product',
    data: {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: config.name,
      description: config.description,
      image: config.image,
      brand: config.brand ? { '@type': 'Brand', name: config.brand } : undefined,
      sku: config.sku,
      offers: config.offers.map(offer => ({
        '@type': 'Offer',
        price: offer.price,
        priceCurrency: offer.currency,
        seller: { '@type': 'Organization', name: offer.seller },
        url: offer.url,
        availability: `https://schema.org/${offer.availability}`,
      })),
      aggregateRating: config.aggregateRating ? {
        '@type': 'AggregateRating',
        ratingValue: config.aggregateRating.ratingValue,
        reviewCount: config.aggregateRating.reviewCount,
      } : undefined,
    },
  };
}

// ═══════════════════════════════════════════════════════════════
//  FINTAX - FAQ STRUCTURED DATA
// ═══════════════════════════════════════════════════════════════

/**
 * Build FAQPage structured data (FinTax)
 */
export function buildFAQPage(questions: Array<{
  question: string;
  answer: string;
}>): StructuredDataConfig {
  return {
    type: 'FAQPage',
    data: {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: questions.map(q => ({
        '@type': 'Question',
        name: q.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: q.answer,
        },
      })),
    },
  };
}

/**
 * Build HowTo structured data (FinTax - tax calculation guides)
 */
export function buildHowTo(config: {
  name: string;
  description: string;
  totalTime?: string; // ISO 8601 duration
  steps: Array<{
    name: string;
    text: string;
    image?: string;
  }>;
}): StructuredDataConfig {
  return {
    type: 'HowTo',
    data: {
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: config.name,
      description: config.description,
      totalTime: config.totalTime,
      step: config.steps.map((step, index) => ({
        '@type': 'HowToStep',
        position: index + 1,
        name: step.name,
        text: step.text,
        image: step.image,
      })),
    },
  };
}

// ═══════════════════════════════════════════════════════════════
//  DOCTORCAR - AUTO REPAIR STRUCTURED DATA
// ═══════════════════════════════════════════════════════════════

/**
 * Build AutoRepair (LocalBusiness) structured data (DoctorCar - garage listings)
 */
export function buildAutoRepair(config: {
  name: string;
  description: string;
  image?: string;
  address: {
    streetAddress: string;
    addressLocality: string; // City
    addressRegion: string;   // Province
    postalCode?: string;
    addressCountry: string;
  };
  telephone?: string;
  priceRange?: string;
  geo?: { latitude: number; longitude: number };
  openingHours?: string[];
  aggregateRating?: {
    ratingValue: number;
    reviewCount: number;
  };
}): StructuredDataConfig {
  return {
    type: 'AutoRepair',
    data: {
      '@context': 'https://schema.org',
      '@type': 'AutoRepair',
      name: config.name,
      description: config.description,
      image: config.image,
      address: {
        '@type': 'PostalAddress',
        ...config.address,
      },
      telephone: config.telephone,
      priceRange: config.priceRange,
      geo: config.geo ? {
        '@type': 'GeoCoordinates',
        latitude: config.geo.latitude,
        longitude: config.geo.longitude,
      } : undefined,
      openingHoursSpecification: config.openingHours?.map(hours => ({
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: hours.split(' ')[0],
        opens: hours.split(' ')[1]?.split('-')[0],
        closes: hours.split(' ')[1]?.split('-')[1],
      })),
      aggregateRating: config.aggregateRating ? {
        '@type': 'AggregateRating',
        ratingValue: config.aggregateRating.ratingValue,
        reviewCount: config.aggregateRating.reviewCount,
      } : undefined,
    },
  };
}

// ═══════════════════════════════════════════════════════════════
//  CAREMATE - HEALTH/MEDICAL STRUCTURED DATA
// ═══════════════════════════════════════════════════════════════

/**
 * Build MedicalWebPage structured data (CareMate - health articles)
 */
export function buildMedicalWebPage(config: {
  name: string;
  description: string;
  url: string;
  datePublished?: string;
  dateModified?: string;
  medicalAudience?: string; // e.g., "Patient", "MedicalResearcher"
  about?: string; // Medical condition/topic
  lastReviewed?: string;
}): StructuredDataConfig {
  return {
    type: 'MedicalWebPage',
    data: {
      '@context': 'https://schema.org',
      '@type': 'MedicalWebPage',
      name: config.name,
      description: config.description,
      url: config.url,
      datePublished: config.datePublished,
      dateModified: config.dateModified,
      medicalAudience: config.medicalAudience ? {
        '@type': 'MedicalAudience',
        audienceType: config.medicalAudience,
      } : undefined,
      about: config.about ? {
        '@type': 'MedicalCondition',
        name: config.about,
      } : undefined,
      lastReviewed: config.lastReviewed,
    },
  };
}

/**
 * Build Drug structured data (CareMate - drug database)
 */
export function buildDrug(config: {
  name: string;
  description: string;
  activeIngredient?: string;
  drugClass?: string;
  dosageForm?: string;
  manufacturer?: string;
  warning?: string;
}): StructuredDataConfig {
  return {
    type: 'DrugClass',
    data: {
      '@context': 'https://schema.org',
      '@type': 'Drug',
      name: config.name,
      description: config.description,
      activeIngredient: config.activeIngredient,
      drugClass: config.drugClass ? {
        '@type': 'DrugClass',
        name: config.drugClass,
      } : undefined,
      dosageForm: config.dosageForm,
      manufacturer: config.manufacturer ? {
        '@type': 'Organization',
        name: config.manufacturer,
      } : undefined,
      warning: config.warning,
    },
  };
}

/**
 * Build Pharmacy (LocalBusiness) structured data (CareMate - pharmacy listings)
 */
export function buildPharmacy(config: {
  name: string;
  description: string;
  image?: string;
  address: {
    streetAddress: string;
    addressLocality: string;
    addressRegion: string;
    postalCode?: string;
    addressCountry: string;
  };
  telephone?: string;
  geo?: { latitude: number; longitude: number };
  openingHours?: string[];
}): StructuredDataConfig {
  return {
    type: 'LocalBusiness',
    data: {
      '@context': 'https://schema.org',
      '@type': 'Pharmacy',
      name: config.name,
      description: config.description,
      image: config.image,
      address: {
        '@type': 'PostalAddress',
        ...config.address,
      },
      telephone: config.telephone,
      geo: config.geo ? {
        '@type': 'GeoCoordinates',
        latitude: config.geo.latitude,
        longitude: config.geo.longitude,
      } : undefined,
      openingHoursSpecification: config.openingHours?.map(hours => ({
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: hours.split(' ')[0],
        opens: hours.split(' ')[1]?.split('-')[0],
        closes: hours.split(' ')[1]?.split('-')[1],
      })),
    },
  };
}

// ═══════════════════════════════════════════════════════════════
//  JSON-LD SERIALIZER
// ═══════════════════════════════════════════════════════════════

/**
 * Serialize structured data to JSON-LD script tag content
 */
export function serializeJsonLd(configs: StructuredDataConfig[]): string {
  if (configs.length === 0) return '';
  
  if (configs.length === 1) {
    return JSON.stringify(configs[0].data, null, 0);
  }
  
  // Multiple structured data items - use @graph
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': configs.map(c => {
      const data = { ...c.data };
      delete data['@context']; // Remove duplicate context
      return data;
    }),
  }, null, 0);
}
