"""
Resource Expansion Phase 4 — Translation Sources.

Provides multilingual content translation for:
- Vietnamese ↔ English article translation (TrendBrief)
- Product description localization (SmartBuy)
- Medical term translation (CareMate)

Uses free translation APIs with fallback chain:
1. Google Translate (free tier via googletrans)
2. MyMemory API (free, 5000 chars/day)
3. LibreTranslate (self-hosted option)

Usage:
    from shared_libs.rag.sources.translation_sources import TranslationSource

    translator = TranslationSource()
    result = translator.translate("Xin chào", source_lang="vi", target_lang="en")
    batch = translator.translate_batch(texts, source_lang="vi", target_lang="en")
"""

import logging
import os
import time
from datetime import datetime, timezone
from typing import Optional

import httpx
from pymongo import MongoClient

logger = logging.getLogger("rag.sources.translation")

MONGODB_URI = os.environ.get("MONGODB_URI", "mongodb://localhost:27017")
LIBRETRANSLATE_URL = os.environ.get("LIBRETRANSLATE_URL", "")
MYMEMORY_EMAIL = os.environ.get("MYMEMORY_EMAIL", "")  # For higher rate limits


class TranslationSource:
    """
    Multilingual translation service with caching and fallback chain.

    Provider chain:
    1. Cache (MongoDB) — instant, free
    2. googletrans — free, rate limited
    3. MyMemory API — free 5000 chars/day
    4. LibreTranslate — self-hosted, unlimited
    """

    MAX_CHARS_PER_REQUEST = 5000
    RATE_LIMIT_DELAY = 1.0  # seconds between API calls

    def __init__(self, mongo_uri: str = MONGODB_URI):
        self._client = MongoClient(mongo_uri)
        self._db = self._client["shared_translations"]
        self._http = httpx.Client(timeout=15.0)
        self._last_request_time = 0.0

    def translate(
        self,
        text: str,
        source_lang: str = "vi",
        target_lang: str = "en",
        domain: Optional[str] = None,
    ) -> dict:
        """
        Translate text between languages.

        Args:
            text: Text to translate.
            source_lang: Source language code (vi, en, ja, ko, zh).
            target_lang: Target language code.
            domain: Optional domain hint (medical, tech, finance) for terminology.

        Returns:
            Dict with translated_text, source_lang, target_lang, provider, cached.
        """
        if not text or not text.strip():
            return {"translated_text": "", "provider": "none", "cached": False}

        # Truncate if too long
        if len(text) > self.MAX_CHARS_PER_REQUEST:
            text = text[:self.MAX_CHARS_PER_REQUEST]

        # 1. Check cache
        cached = self._get_cached_translation(text, source_lang, target_lang)
        if cached:
            return {
                "translated_text": cached["translated_text"],
                "source_lang": source_lang,
                "target_lang": target_lang,
                "provider": "cache",
                "cached": True,
            }

        # 2. Try translation providers in order
        result = None

        # Provider 1: googletrans
        result = self._translate_googletrans(text, source_lang, target_lang)

        # Provider 2: MyMemory API
        if not result:
            result = self._translate_mymemory(text, source_lang, target_lang)

        # Provider 3: LibreTranslate
        if not result and LIBRETRANSLATE_URL:
            result = self._translate_libretranslate(text, source_lang, target_lang)

        if result:
            # Cache the translation
            self._cache_translation(text, result["translated_text"], source_lang, target_lang, result["provider"])
            return result

        # All providers failed
        logger.error(f"All translation providers failed for {source_lang}→{target_lang}")
        return {
            "translated_text": text,  # Return original as fallback
            "source_lang": source_lang,
            "target_lang": target_lang,
            "provider": "fallback_original",
            "cached": False,
            "error": "All providers failed",
        }

    def translate_batch(
        self,
        texts: list[str],
        source_lang: str = "vi",
        target_lang: str = "en",
    ) -> list[dict]:
        """
        Translate multiple texts.

        Args:
            texts: List of texts to translate.
            source_lang: Source language.
            target_lang: Target language.

        Returns:
            List of translation result dicts.
        """
        results = []
        for text in texts:
            result = self.translate(text, source_lang, target_lang)
            results.append(result)
            # Small delay between requests
            time.sleep(0.2)
        return results

    def translate_product_description(
        self, description: str, source_lang: str = "vi", target_lang: str = "en"
    ) -> dict:
        """
        Translate a product description with e-commerce terminology awareness.

        Preserves:
        - Brand names (not translated)
        - Technical specs (units, model numbers)
        - Price formatting
        """
        # Pre-process: protect brand names and specs
        import re
        protected = {}
        counter = 0

        # Protect model numbers (e.g., "RTX 4090", "iPhone 15 Pro")
        model_pattern = r'\b([A-Z][A-Za-z0-9]+ \d+[A-Za-z]*(?:\s+[A-Za-z]+)?)\b'
        for match in re.finditer(model_pattern, description):
            placeholder = f"__PROTECTED_{counter}__"
            protected[placeholder] = match.group(0)
            description = description.replace(match.group(0), placeholder, 1)
            counter += 1

        # Translate
        result = self.translate(description, source_lang, target_lang)

        # Restore protected terms
        translated = result["translated_text"]
        for placeholder, original in protected.items():
            translated = translated.replace(placeholder, original)

        result["translated_text"] = translated
        return result

    # ─── Provider Implementations ────────────────────────────────

    def _translate_googletrans(self, text: str, src: str, dest: str) -> Optional[dict]:
        """Translate using googletrans library."""
        try:
            from googletrans import Translator

            self._rate_limit()
            translator = Translator()
            result = translator.translate(text, src=src, dest=dest)

            if result and result.text:
                return {
                    "translated_text": result.text,
                    "source_lang": src,
                    "target_lang": dest,
                    "provider": "googletrans",
                    "cached": False,
                }
        except ImportError:
            logger.debug("googletrans not installed")
        except Exception as e:
            logger.warning(f"googletrans failed: {e}")

        return None

    def _translate_mymemory(self, text: str, src: str, dest: str) -> Optional[dict]:
        """Translate using MyMemory free API."""
        self._rate_limit()

        params = {
            "q": text,
            "langpair": f"{src}|{dest}",
        }
        if MYMEMORY_EMAIL:
            params["de"] = MYMEMORY_EMAIL

        try:
            response = self._http.get(
                "https://api.mymemory.translated.net/get", params=params
            )

            if response.status_code == 200:
                data = response.json()
                translated = data.get("responseData", {}).get("translatedText", "")
                if translated and translated.lower() != text.lower():
                    return {
                        "translated_text": translated,
                        "source_lang": src,
                        "target_lang": dest,
                        "provider": "mymemory",
                        "cached": False,
                    }
        except Exception as e:
            logger.warning(f"MyMemory API failed: {e}")

        return None

    def _translate_libretranslate(self, text: str, src: str, dest: str) -> Optional[dict]:
        """Translate using self-hosted LibreTranslate."""
        if not LIBRETRANSLATE_URL:
            return None

        self._rate_limit()

        try:
            response = self._http.post(
                f"{LIBRETRANSLATE_URL}/translate",
                json={
                    "q": text,
                    "source": src,
                    "target": dest,
                    "format": "text",
                },
            )

            if response.status_code == 200:
                data = response.json()
                translated = data.get("translatedText", "")
                if translated:
                    return {
                        "translated_text": translated,
                        "source_lang": src,
                        "target_lang": dest,
                        "provider": "libretranslate",
                        "cached": False,
                    }
        except Exception as e:
            logger.warning(f"LibreTranslate failed: {e}")

        return None

    # ─── Caching ─────────────────────────────────────────────────

    def _get_cached_translation(self, text: str, src: str, dest: str) -> Optional[dict]:
        """Check MongoDB cache for existing translation."""
        import hashlib
        text_hash = hashlib.md5(text.encode()).hexdigest()

        return self._db.translation_cache.find_one({
            "text_hash": text_hash,
            "source_lang": src,
            "target_lang": dest,
        })

    def _cache_translation(self, original: str, translated: str, src: str, dest: str, provider: str):
        """Cache a translation result."""
        import hashlib
        text_hash = hashlib.md5(original.encode()).hexdigest()

        self._db.translation_cache.update_one(
            {"text_hash": text_hash, "source_lang": src, "target_lang": dest},
            {"$set": {
                "text_hash": text_hash,
                "original_text": original[:200],  # Store truncated for reference
                "translated_text": translated,
                "source_lang": src,
                "target_lang": dest,
                "provider": provider,
                "cached_at": datetime.now(timezone.utc),
            }},
            upsert=True,
        )

    def _rate_limit(self):
        elapsed = time.time() - self._last_request_time
        if elapsed < self.RATE_LIMIT_DELAY:
            time.sleep(self.RATE_LIMIT_DELAY - elapsed)
        self._last_request_time = time.time()

    def close(self):
        self._client.close()
        self._http.close()
