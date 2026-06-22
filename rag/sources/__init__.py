"""
shared-libs/rag/sources — Resource Expansion Phase 4 crawl sources.

New data sources for enriching the RAG pipeline:
- Amazon Product API (affiliate product data)
- iHerb API (health/supplement products)
- Google Maps Places API (local business data)
- Playwright-based sources (JS-rendered pages)
- Translation sources (multilingual content)
- Low-priority background sources
- PDF extraction (document parsing)
- Affiliate tracking integration
"""

from .amazon_api import AmazonProductSource
from .iherb_api import IHerbSource
from .google_maps_api import GoogleMapsSource
from .playwright_sources import PlaywrightCrawlSource
from .translation_sources import TranslationSource
from .low_priority_sources import LowPrioritySourceManager
from .pdf_extraction import PDFExtractionSource
from .affiliate_tracking import AffiliateTrackingSource

__all__ = [
    "AmazonProductSource",
    "IHerbSource",
    "GoogleMapsSource",
    "PlaywrightCrawlSource",
    "TranslationSource",
    "LowPrioritySourceManager",
    "PDFExtractionSource",
    "AffiliateTrackingSource",
]
